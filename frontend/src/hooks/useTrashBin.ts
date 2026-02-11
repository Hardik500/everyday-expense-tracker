import { useState, useCallback, useEffect } from 'react';
import { fetchWithAuth } from '../utils/api';

interface TrashItem {
  id: number;
  original_table: string;
  original_id: number;
  data: any;
  deleted_at: string;
  deleted_by: number;
}

interface UseTrashBinOptions {
  apiBase: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useTrashBin(options: UseTrashBinOptions) {
  const { apiBase, autoRefresh = false, refreshInterval = 30000 } = options;
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrashItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetchWithAuth(`${apiBase}/trash`);
      if (!response.ok) throw new Error('Failed to fetch trash items');
      
      const data = await response.json();
      setTrashItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  const softDelete = useCallback(async (
    table: string,
    id: number,
    reason?: string
  ): Promise<{ success: boolean; trashId?: number; error?: string }> => {
    try {
      const response = await fetchWithAuth(`${apiBase}/trash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id, reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete item');
      }

      const data = await response.json();
      await fetchTrashItems();
      return { success: true, trashId: data.trash_id };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    }
  }, [apiBase, fetchTrashItems]);

  const restore = useCallback(async (
    trashId: number
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetchWithAuth(`${apiBase}/trash/${trashId}/restore`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to restore item');
      }

      await fetchTrashItems();
      return { success: true };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    }
  }, [apiBase, fetchTrashItems]);

  const permanentDelete = useCallback(async (
    trashId: number
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetchWithAuth(`${apiBase}/trash/${trashId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to permanently delete');
      }

      await fetchTrashItems();
      return { success: true };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    }
  }, [apiBase, fetchTrashItems]);

  const emptyTrash = useCallback(async (
    beforeDate?: string
  ): Promise<{ success: boolean; deletedCount?: number; error?: string }> => {
    try {
      const params = beforeDate ? `?before_date=${beforeDate}` : '';
      const response = await fetchWithAuth(`${apiBase}/trash/empty${params}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to empty trash');
      }

      const data = await response.json();
      await fetchTrashItems();
      return { success: true, deletedCount: data.deleted_count };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    }
  }, [apiBase, fetchTrashItems]);

  // Auto refresh
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchTrashItems, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchTrashItems]);

  // Initial fetch
  useEffect(() => {
    fetchTrashItems();
  }, [fetchTrashItems]);

  return {
    trashItems,
    loading,
    error,
    refresh: fetchTrashItems,
    softDelete,
    restore,
    permanentDelete,
    emptyTrash,
    trashCount: trashItems.length,
  };
}

export default useTrashBin;
