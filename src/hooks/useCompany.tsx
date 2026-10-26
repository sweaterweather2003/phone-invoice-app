import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as db from '../db/firebaseDb';
import type { Company } from '../types';
import { useAuth } from './useAuth';

interface CompanyContextValue {
  company: Company | null;
  companies: Company[];
  loading: boolean;
  setActiveCompany: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  createCompany: (data: Omit<Company, 'id' | 'createdAt'>) => Promise<Company>;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setCompanies([]);
      setCompany(null);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const list = await db.getCompanies();
      setCompanies(list || []);
      const activeId = await db.getSetting('activeCompanyId');
      if (activeId) {
        const c = list?.find((x) => x.id === activeId) || list?.[0] || null;
        setCompany(c);
        if (c && c.id !== activeId) await db.setSetting('activeCompanyId', c.id);
      } else if (list && list.length > 0) {
        setCompany(list[0]);
        await db.setSetting('activeCompanyId', list[0].id);
      } else {
        setCompany(null);
      }
    } catch (err: any) {
      console.warn('CompanyProvider initialization error:', err?.message);
      setError(err?.message || 'Failed to load companies');
      setCompany(null);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    refresh().then(() => {
      if (isMounted) setLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [refresh, user]);


  const setActiveCompany = async (id: string) => {
    try {
      await db.setSetting('activeCompanyId', id);
      const c = await db.getCompany(id);
      setCompany(c);
    } catch (err: any) {
      console.warn('setActiveCompany error:', err?.message);
    }
  };

  const createCompany = async (data: Omit<Company, 'id' | 'createdAt'>) => {
    try {
      const c = await db.createCompany(data);
      await db.setSetting('activeCompanyId', c.id);
      await refresh();
      return c;
    } catch (err: any) {
      console.warn('createCompany error:', err?.message);
      throw err;
    }
  };

  return (
    <CompanyContext.Provider
      value={{ company, companies, loading, setActiveCompany, refresh, createCompany }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
