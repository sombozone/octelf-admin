import axios from 'axios';
import type { RouteRecordNormalized } from 'vue-router';
import { UserState } from '@/store/modules/user/types';
import {
  supabase,
  SupabaseLoginData,
  SupabaseLoginResponse,
} from '@/config/supabase';

export interface LoginData {
  phone: string;
  password: string;
}

export interface LoginRes {
  token: string;
  user: {
    id: string;
    email?: string;
    phone?: string;
    created_at: string;
    updated_at: string;
  };
}

export async function login(data: LoginData): Promise<{ data: LoginRes }> {
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    phone: data.phone,
    password: data.password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!authData.session) {
    throw new Error('Login failed: No session returned');
  }

  return {
    data: {
      token: authData.session.access_token,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        phone: authData.user.phone || '',
        created_at: authData.user.created_at,
        updated_at: authData.user.updated_at || authData.user.created_at,
      },
    },
  };
}

export async function logout(): Promise<{ data: null }> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
  return { data: null };
}

export async function getUserInfo(): Promise<{ data: UserState }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Map Supabase user data to UserState
  const userInfo: UserState = {
    avatar: user.user_metadata?.avatar,
    job: user.user_metadata?.job,
    organization: user.user_metadata?.organization,
    location: user.user_metadata?.location,
    email: user.email,
    introduction: user.user_metadata?.introduction,
    personalWebsite: user.user_metadata?.personalWebsite,
    jobName: user.user_metadata?.jobName,
    organizationName: user.user_metadata?.organizationName,
    locationName: user.user_metadata?.locationName,
    phone: user.phone,
    registrationDate: user.created_at,
    accountId: user.id,
    certification: user.user_metadata?.certification,
    role: user.user_metadata?.role || 'user',
  };

  return { data: userInfo };
}

export function getMenuList() {
  return axios.post<RouteRecordNormalized[]>('/api/user/menu');
}
