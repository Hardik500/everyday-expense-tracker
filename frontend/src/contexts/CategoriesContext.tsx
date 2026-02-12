import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { fetchWithAuth } from '../utils/api';
import type { Category, Subcategory } from '../App';

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface CategoriesContextType {
    categories: Category[];
    subcategories: Subcategory[];
    isLoading: boolean;
    refreshCategories: () => void;
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined);

export const CategoriesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { token } = useAuth();
    const [categories, setCategories] = useState<Category[]>([]);
    const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const refreshCategories = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (!token) {
            setCategories([]);
            setSubcategories([]);
            return;
        }

        let isMounted = true;
        setIsLoading(true);

        fetchWithAuth(`${API_BASE}/categories`)
            .then((res) => res.json())
            .then((data) => {
                if (isMounted) {
                    setCategories(Array.isArray(data?.categories) ? data.categories : []);
                    setSubcategories(Array.isArray(data?.subcategories) ? data.subcategories : []);
                }
            })
            .catch((err) => {
                console.error("Failed to fetch categories:", err);
                if (isMounted) {
                    setCategories([]);
                    setSubcategories([]);
                }
            })
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });

        return () => { isMounted = false; };
    }, [token, refreshTrigger]);

    return (
        <CategoriesContext.Provider value={{ categories, subcategories, isLoading, refreshCategories }}>
            {children}
        </CategoriesContext.Provider>
    );
};

export const useCategories = () => {
    const context = useContext(CategoriesContext);
    if (context === undefined) {
        throw new Error('useCategories must be used within a CategoriesProvider');
    }
    return context;
};
