import React, { createContext, useContext, useState, ReactNode } from 'react';

export type FilterType = 'all' | 'last_10_days' | 'final_round' | 'offers';

interface FilterContextType {
  filter: FilterType;
  filterTitle: string;
  setFilter: (filter: FilterType) => void;
  clearFilter: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<FilterType>('all');

  const filterTitles: Record<FilterType, string> = {
    'all': 'My Jobs',
    'last_10_days': 'Last 10 Days',
    'final_round': 'Final Round',
    'offers': 'Offers',
  };

  const setFilter = (newFilter: FilterType) => {
    setFilterState(newFilter);
  };

  const clearFilter = () => {
    setFilterState('all');
  };

  return (
    <FilterContext.Provider value={{
      filter,
      filterTitle: filterTitles[filter],
      setFilter,
      clearFilter,
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
