import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, Page } from '../api/client';

/** Paginated list with debounced search and filters, backed by the real API. */
export function useList<T>(path: string, filters: Record<string, string | undefined> = {}, pageSize = 20) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const filterKey = JSON.stringify(filters);
  useEffect(() => setPage(1), [debounced, filterKey]);
  const query = useQuery({
    queryKey: [path, { page, pageSize, q: debounced, ...filters }],
    queryFn: () => api.get<Page<T>>(path, { page, pageSize, q: debounced || undefined, ...filters }),
    placeholderData: keepPreviousData,
  });
  return { ...query, page, setPage, search, setSearch, pageSize };
}
