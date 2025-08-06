import { createClient } from '@supabase/supabase-js';

// 创建 Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env files.'
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface WaterBalanceQuery {
  groupName: string;
  statDate: string;
}

export interface WaterBalanceItem {
  id: string;
  pid: string | null;
  name: string;
  waterVolume: number;
  waterAmount: number;
  path: string; // 接口已提供path字段
  children: WaterBalanceItem[];
}

export interface WaterBalanceResponse {
  data: WaterBalanceItem[];
  success: boolean;
}

// 颜色索引计数器
let colorIndex = 0;

// 根据节点名称设置颜色
function getNodeColor(): string {
  // 预定义的颜色数组
  const colors = [
    '#5470c6',
    '#91cc75',
    '#fac858',
    '#ee6666',
    '#73c0de',
    '#3ba272',
    '#fc8452',
    '#9a60b4',
    '#ea7ccc',
    '#58d9f9',
    '#f7b23b',
    '#ff7875',
    '#95de64',
    '#b37feb',
    '#ffd666',
    '#ff9c6e',
    '#69c0ff',
    '#bae637',
    '#ff85c0',
    '#5cdbd3',
    '#ffa940',
    '#9254de',
    '#40a9ff',
    '#73d13d',
    '#ff4d4f',
    '#722ed1',
    '#13c2c2',
    '#fa8c16',
    '#eb2f96',
    '#52c41a',
  ];

  // 从颜色列表中顺序取值
  const color = colors[colorIndex % colors.length];
  colorIndex += 1;

  return color;
}

// 重置颜色索引（可选，用于重新开始颜色分配）
export function resetColorIndex(): void {
  colorIndex = 0;
}

export async function queryWaterBalance(
  data: WaterBalanceQuery
): Promise<WaterBalanceResponse> {
  const { groupName, statDate } = data;

  try {
    // 直接调用 Supabase function
    const { data: result, error } = await supabase.functions.invoke(
      'waterBalance',
      {
        body: {
          groupName,
          statDate,
        },
      }
    );

    if (error) {
      throw new Error(`调用 waterBalance function 失败: ${error.message}`);
    }

    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('水平衡查询失败:', error);
    throw error;
  }
}

export interface WaterBalanceTreeNode {
  name: string;
  value: number;
  path?: string; // 添加路径字段
  children?: WaterBalanceTreeNode[];
  itemStyle?: {
    color?: string;
  };
}

export interface WaterBalanceTreeData {
  name: string;
  children: WaterBalanceTreeNode[];
}

// 参考 ECharts treemap-show-parent 示例，直接使用接口提供的 path 字段
export function convertToTreemapData(
  waterBalanceData: WaterBalanceItem[]
): WaterBalanceTreeData {
  const convertNode = (item: WaterBalanceItem): WaterBalanceTreeNode => {
    const node: WaterBalanceTreeNode = {
      name: item.name,
      value: item.waterVolume,
      path: item.path, // 直接使用接口提供的 path 字段
      itemStyle: {
        color: getNodeColor(),
      },
    };

    // 如果有子节点，递归转换
    if (item.children && item.children.length > 0) {
      node.children = item.children.map((child) => convertNode(child));
    }

    return node;
  };

  // 简化数据结构，直接返回所有节点
  let result: WaterBalanceTreeData;
  if (waterBalanceData.length === 1) {
    const rootNode = convertNode(waterBalanceData[0]);
    // 直接返回根节点，让 ECharts 处理层级显示
    result = {
      name: rootNode.name,
      children: [rootNode], // 确保根节点被包含
    };
  } else {
    result = {
      name: '水平衡',
      children: waterBalanceData.map((item) => convertNode(item)),
    };
  }

  // 打印转换后的 treemap 数据
  // eslint-disable-next-line no-console
  console.log('=== convertToTreemapData 输出的 JSON 数据 ===');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
  // eslint-disable-next-line no-console
  console.log('=== convertToTreemapData 结束 ===');

  return result;
}

// 移除复杂的层级布局函数，直接使用简化的转换

// 调试函数：验证数据结构是否包含根节点
export function debugTreemapData(data: WaterBalanceTreeData): void {
  // eslint-disable-next-line no-console
  console.log('=== Treemap 数据结构调试 ===');
  // eslint-disable-next-line no-console
  console.log('根容器名称:', data.name);
  // eslint-disable-next-line no-console
  console.log('子节点数量:', data.children.length);

  const printNode = (node: WaterBalanceTreeNode, level = 0): void => {
    const indent = '  '.repeat(level);
    // eslint-disable-next-line no-console
    console.log(
      `${indent}- ${node.name} (值: ${node.value}, 路径: ${node.path})`
    );

    if (node.children && node.children.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`${indent}  包含 ${node.children.length} 个子节点:`);
      node.children.forEach((child) => printNode(child, level + 1));
    }
  };

  data.children.forEach((child, index) => {
    // eslint-disable-next-line no-console
    console.log(`\n第${index + 1}个顶级节点:`);
    printNode(child, 0);
  });

  // 统计所有节点
  const countNodes = (node: WaterBalanceTreeNode): number => {
    let count = 1;
    if (node.children) {
      count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
    }
    return count;
  };

  const totalNodes = data.children.reduce(
    (sum, child) => sum + countNodes(child),
    0
  );
  // eslint-disable-next-line no-console
  console.log(`\n总节点数: ${totalNodes}`);
  // eslint-disable-next-line no-console
  console.log('=== 调试结束 ===');
}

