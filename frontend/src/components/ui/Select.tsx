import { useState, useRef, useEffect, memo, useCallback } from "react";

export type Option<T extends string | number = string | number> = {
    value: T;
    label: string;
};

type Props<T extends string | number = string | number> = {
    value: T;
    onChange: (value: T) => void;
    options: Option<T>[];
    placeholder?: string;
    className?: string;
    style?: React.CSSProperties;
    label?: string;
};

function Select<T extends string | number = string | number>({ value, onChange, options, placeholder = "Select...", className, style, label }: Props<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);

    const handleClickOutside = useCallback((event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
            setIsOpen(false);
        }
    }, []);

    // Close when clicking outside
    useEffect(() => {
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [handleClickOutside]);

    const handleOptionClick = useCallback((optionValue: T) => {
        onChange(optionValue);
        setIsOpen(false);
    }, [onChange]);

    const toggleOpen = useCallback(() => {
        setIsOpen(prev => !prev);
    }, []);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{ minWidth: 150, position: "relative", ...style }}
        >
            {label && (
                <label className="block text-sm text-text-muted mb-1 font-medium">
                    {label}
                </label>
            )}

            {/* Trigger */}
            <div
                onClick={toggleOpen}
                className={`px-3 py-2 bg-bg-input border rounded-lg text-sm cursor-pointer flex items-center justify-between transition-all duration-200 ${
                    isOpen
                        ? "border-accent shadow-[0_0_0_2px_rgba(99,102,241,0.2)]"
                        : "border-border-color hover:border-accent/50"
                } ${selectedOption ? "text-text-primary" : "text-text-muted"}`}
            >
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <svg
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    className={`ml-2 flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 bg-bg-card border border-border-color rounded-lg shadow-lg z-[100] max-h-[250px] overflow-y-auto animate-fade-in">
                    {options.length > 0 ? (
                        options.map((option) => (
                            <div
                                key={option.value}
                                onClick={() => handleOptionClick(option.value)}
                                className={`px-3 py-2.5 text-sm cursor-pointer transition-colors duration-100 flex items-center justify-between ${
                                    option.value === value
                                        ? "text-accent bg-accent/10"
                                        : "text-text-primary hover:bg-bg-hover"
                                }`}
                            >
                                {option.label}
                                {option.value === value && (
                                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="p-3 text-center text-text-muted text-sm">
                            No options
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default Select;
