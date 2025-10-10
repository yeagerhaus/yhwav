import { createContext, type ReactNode, useContext, useState } from 'react';

interface SearchContextType {
	query: string;
	setQuery: (query: string) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
	const [query, setQuery] = useState('');

	return <SearchContext.Provider value={{ query, setQuery }}>{children}</SearchContext.Provider>;
}

export function useSearchContext() {
	const context = useContext(SearchContext);
	if (context === undefined) {
		throw new Error('useSearchContext must be used within a SearchProvider');
	}
	return context;
}
