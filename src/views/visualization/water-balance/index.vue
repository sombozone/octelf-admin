<template>
  <div class="container">
    <Breadcrumb
      :items="['menu.visualization', 'menu.visualization.waterBalance']"
    />
    <a-space direction="vertical" :size="16" fill>
      <!-- 查询条件 -->
      <a-card title="查询条件" :bordered="false">
        <a-form :model="queryForm" layout="inline" @submit="handleQuery">
          <a-form-item field="groupName" label="分组名称">
            <a-input
              v-model="queryForm.groupName"
              placeholder="请输入分组名称"
              allow-clear
            />
          </a-form-item>
          <a-form-item field="statDate" label="统计日期">
            <a-date-picker
              v-model="queryForm.statDate"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              placeholder="请选择统计日期"
            />
          </a-form-item>
          <a-form-item>
            <a-button type="primary" html-type="submit" :loading="loading">
              查询
            </a-button>
            <a-button style="margin-left: 8px" @click="handleReset">
              重置
            </a-button>
          </a-form-item>
        </a-form>
      </a-card>

      <!-- 图表展示 -->
      <a-card title="水平衡树图" :bordered="false">
        <div class="chart-container">
          <v-chart
            v-if="treeData"
            :option="chartOption"
            :style="{ height: '600px' }"
            autoresize
          />
          <a-empty v-else description="暂无数据" />
        </div>
      </a-card>
    </a-space>
  </div>
</template>

<script lang="ts" setup>
  import { ref, reactive, computed, onMounted } from 'vue';
  import { Message } from '@arco-design/web-vue';
  import { use } from 'echarts/core';
  import { CanvasRenderer } from 'echarts/renderers';
  import { TreemapChart } from 'echarts/charts';
  import {
    TitleComponent,
    TooltipComponent,
    LegendComponent,
  } from 'echarts/components';
  import VChart from 'vue-echarts';
  import {
    queryWaterBalance,
    type WaterBalanceQuery,
    type WaterBalanceItem,
    type WaterBalanceTreeData,
    convertToTreemapData,
    resetColorIndex,
  } from '@/api/water-balance';

  use([
    CanvasRenderer,
    TreemapChart,
    TitleComponent,
    TooltipComponent,
    LegendComponent,
  ]);

  const loading = ref(false);
  const treeData = ref<WaterBalanceTreeData | null>(null);

  const queryForm = reactive<WaterBalanceQuery>({
    groupName: '默认分组',
    statDate: '2024-01-01',
  });

  const chartOption = computed(() => {
    if (!treeData.value) return {};

    return {
      title: {
        text: '水平衡树图',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold',
        },
      },
      tooltip: {
        formatter: (params: any) => {
          // 参考示例，显示完整的树路径
          const { value, treePathInfo, data, name } = params;
          let treePath = [];

          if (treePathInfo && treePathInfo.length > 1) {
            // 从第二个开始，跳过根容器
            for (let i = 1; i < treePathInfo.length; i += 1) {
              treePath.push(treePathInfo[i].name);
            }
          } else {
            // 如果没有 treePathInfo，使用我们自己的 path 字段
            treePath = data.path ? data.path.split('/') : [name];
          }

          return [
            `<div class="tooltip-title">${treePath.join('/')}</div>`,
            `水量: ${value.toLocaleString()} 立方米`,
            `金额: ${getAmountByNode(name).toLocaleString()} 元`,
          ].join('<br/>');
        },
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderColor: '#fff',
        textStyle: {
          color: '#fff',
        },
      },
      // 响应式配置
      grid: {
        containLabel: true,
      },
      series: [
        {
          type: 'treemap',
          name: '水平衡',
          data: treeData.value ? treeData.value.children : [],
          // 参考示例配置
          visibleMin: 300,
          label: {
            show: true,
            formatter: '{b}',
          },
          // 显示父节点标签
          upperLabel: {
            show: true,
            height: 30,
            fontSize: 12,
            fontWeight: 'bold',
          },
          itemStyle: {
            borderColor: '#fff',
          },
          // 显示所有层级，不限制深度
          leafDepth: null,
          drillDownIcon: '▶',
          // 参考示例的层级配置
          levels: [
            {
              // 第一层级 - 根层级
              itemStyle: {
                borderColor: '#777',
                borderWidth: 0,
                gapWidth: 1,
              },
              upperLabel: {
                show: false,
              },
            },
            {
              // 第二层级
              itemStyle: {
                borderColor: '#555',
                borderWidth: 5,
                gapWidth: 1,
              },
              emphasis: {
                itemStyle: {
                  borderColor: '#ddd',
                },
              },
            },
            {
              // 第三层级及以下
              colorSaturation: [0.35, 0.5],
              itemStyle: {
                borderWidth: 5,
                gapWidth: 1,
                borderColorSaturation: 0.6,
              },
            },
          ],
          // 启用交互
          roam: true,
          nodeClick: 'zoomToNode',
          zoomToNodeRatio: 0.1,
        },
      ],
    };
  });

  // 存储原始数据用于金额查找
  const originalData = ref<WaterBalanceItem[]>([]);

  // 根据节点名称获取金额
  const getAmountByNode = (nodeName: string): number => {
    const findInTree = (items: WaterBalanceItem[]): number => {
      const directMatch = items.find((item) => item.name === nodeName);
      if (directMatch) {
        return directMatch.waterAmount;
      }

      // 递归查找子节点
      const childResult = items
        .filter((item) => item.children && item.children.length > 0)
        .map((item) => findInTree(item.children))
        .find((amount) => amount > 0);

      return childResult || 0;
    };
    return findInTree(originalData.value);
  };

  // 查询数据
  const handleQuery = async () => {
    if (!queryForm.groupName || !queryForm.statDate) {
      Message.warning('请填写完整的查询条件');
      return;
    }

    loading.value = true;
    try {
      // 重置颜色索引，确保每次查询都从第一个颜色开始
      resetColorIndex();

      const response = await queryWaterBalance(queryForm);

      if (response.success && response.data) {
        // 打印原始响应数据
        // eslint-disable-next-line no-console
        console.log('=== 原始 Supabase Function 响应数据 ===');
        // eslint-disable-next-line no-console
        console.log('response:', JSON.stringify(response, null, 2));
        // eslint-disable-next-line no-console
        console.log('response.data:', response.data);
        // eslint-disable-next-line no-console
        console.log('=== 原始数据打印结束 ===');

        // 存储原始树形数据用于路径查找
        originalData.value = response.data;

        // 使用简化的转换函数，直接使用原始数据结构
        treeData.value = convertToTreemapData(response.data);

        // 专门打印 treemap 渲染用的 JSON 数据
        if (treeData.value) {
          // eslint-disable-next-line no-console
          console.log('=== TREEMAP 渲染用 JSON 数据 ===');
          // eslint-disable-next-line no-console
          console.log('传递给 ECharts treemap series.data 的数据:');
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(treeData.value.children, null, 2));
          // eslint-disable-next-line no-console
          console.log('=== TREEMAP JSON 数据结束 ===');
        }

        Message.success('查询成功');
      } else {
        Message.error('查询失败，请稍后重试');
      }
    } catch (error) {
      Message.error('查询失败，请稍后重试');
    } finally {
      loading.value = false;
    }
  };

  // 重置查询条件
  const handleReset = () => {
    queryForm.groupName = '默认分组';
    queryForm.statDate = '2024-01-01';
    originalData.value = [];
    treeData.value = null;
  };

  // 页面加载时自动查询
  onMounted(() => {
    handleQuery();
  });
</script>

<script lang="ts">
  export default {
    name: 'WaterBalance',
  };
</script>

<style scoped lang="less">
  .container {
    padding: 0 20px 20px 20px;
    margin-bottom: 20px;
  }

  .chart-container {
    min-height: 600px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :deep(.arco-card-header) {
    border-bottom: 1px solid var(--color-border);
  }

  :deep(.arco-form-item) {
    margin-bottom: 16px;
  }

  // Tooltip 样式
  :global(.tooltip-title) {
    font-weight: bold;
    font-size: 14px;
    color: #fff;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  }
</style>
