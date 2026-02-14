import React, { createContext, useContext, useState, ReactNode } from 'react';

export type FilterType = 'all' | 'last_10_days' | 'final_round' | 'offers' | 'work_mode' | 'rejected';
export type WorkModeType = 'all' | 'remote' | 'onsite' | 'hybrid';

interface FilterContextType {
  filter: FilterType;
  filterTitle: string;
  workModeFilter: WorkModeType;
  setFilter: (filter: FilterType, workMode?: string) => void;
  clearFilter: () => void;
  dashboardRefreshTrigger: number;
  triggerDashboardRefresh: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<FilterType>('all');
  const [workModeFilter, setWorkModeFilter] = useState<WorkModeType>('all');
  const [dashboardRefreshTrigger, setDashboardRefreshTrigger] = useState(0);

  const filterTitles: Record<FilterType, string> = {
    'all': 'My Jobs',
    'last_10_days': 'Last 10 Days',
    'final_round': 'Final Round',
    'offers': 'Offers',
    'work_mode': 'By Work Mode',
    'rejected': 'Rejected',
  };

  const setFilter = (newFilter: FilterType, workMode?: string) => {
    setFilterState(newFilter);
    if (newFilter === 'work_mode' && workMode) {
      setWorkModeFilter(workMode as WorkModeType);
    } else if (newFilter !== 'work_mode') {
      setWorkModeFilter('all');
    }
  };

  const clearFilter = () => {
    setFilterState('all');
    setWorkModeFilter('all');
  };

  const triggerDashboardRefresh = () => {
    setDashboardRefreshTrigger(prev => prev + 1);
  };

  return (
    <FilterContext.Provider value={{
      filter,
      filterTitle: filterTitles[filter],
      workModeFilter,
      setFilter,
      clearFilter,
      dashboardRefreshTrigger,
      triggerDashboardRefresh,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
}
