import { useState, useEffect, useRef, useCallback } from 'react';
import { getCachedData, setCachedData } from '../utils/cache';

/**
 * A lightweight custom hook for fetching and caching Firebase data
 * Implements Stale-While-Revalidate pattern.
 * 
 * @param {string} key Unique cache key
 * @param {Function} fetcher Async function that returns data
 * @param {Object} options Options object { ttlMs, dependencies, enabled, keepPreviousData }
 */
export function useFirebaseData(key, fetcher, options = {}) {
  const { 
    ttlMs = 5 * 60 * 1000, 
    dependencies = [], 
    enabled = true,
    keepPreviousData = true
  } = options;

  const [state, setState] = useState(() => {
    if (!enabled || !key) return { data: null, loading: false, error: null, refreshing: false };
    const cached = getCachedData(key);
    return {
      data: cached?.data || null,
      loading: !cached, // only strictly loading if no cache
      error: null,
      refreshing: false // background refresh indicator
    };
  });

  const fetchIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async (force = false) => {
    if (!enabled || !key) return;

    const currentFetchId = ++fetchIdRef.current;
    const cached = getCachedData(key);
    const isStale = !cached || Date.now() > cached.expiresAt;

    if (!force && !isStale && cached) {
      if (state.data !== cached.data) {
        setState(s => ({ ...s, data: cached.data, loading: false, error: null }));
      }
      return;
    }

    setState(s => {
      const isInitialLoading = !cached && (!keepPreviousData || !s.data);
      return { 
        ...s, 
        loading: isInitialLoading, 
        refreshing: !isInitialLoading, 
        error: null 
      };
    });

    try {
      const result = await fetcher();
      if (!isMountedRef.current || currentFetchId !== fetchIdRef.current) return;

      setCachedData(key, result, ttlMs);
      
      setState({
        data: result,
        loading: false,
        refreshing: false,
        error: null
      });
    } catch (err) {
      if (!isMountedRef.current || currentFetchId !== fetchIdRef.current) return;
      
      setState(s => ({
        ...s,
        loading: false,
        refreshing: false,
        error: err
      }));
    }
  }, [key, enabled, fetcher, ttlMs, keepPreviousData]);

  useEffect(() => {
    fetchData();
  }, [key, enabled, ...dependencies]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refreshing: state.refreshing,
    refresh: () => fetchData(true)
  };
}
