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
                <label
                    style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        color: "var(--text-muted)",
                        marginBottom: "0.375rem",
                        fontWeight: 500,
                    }}
                >
                    {label}
                </label>
            )}

            {/* Trigger */}
            <div
                onClick={toggleOpen}
                style={{
                    padding: "0.5rem 0.75rem",
                    background: "var(--bg-input)",
                    border: `1px solid ${isOpen ? "var(--accent)" : "var(--border-color)"}`,
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.875rem",
                    color: selectedOption ? "var(--text-primary)" : "var(--text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "all 0.2s ease",
                    boxShadow: isOpen ? "0 0 0 2px rgba(99, 102, 241, 0.2)" : "none",
                    userSelect: "none",
                }}
            >
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <svg
                    width="16"
                    height="16"
                    fill="none"
                    stroke="var(--text-muted)"
                    viewBox="0 0 24 24"
                    style={{
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        marginLeft: "0.5rem",
                        flexShrink: 0,
                    }}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        zIndex: 100,
                        maxHeight: 250,
                        overflowY: "auto",
                        animation: "fadeIn 0.1s ease",
                    }}
                >
                    {options.length > 0 ? (
                        options.map((option) => (
                            <div
                                key={option.value}
                                onClick={() => handleOptionClick(option.value)}
                                style={{
                                    padding: "0.625rem 0.75rem",
                                    fontSize: "0.875rem",
                                    color: option.value === value ? "var(--accent)" : "var(--text-primary)",
                                    background: option.value === value ? "var(--accent-glow)" : "transparent",
                                    cursor: "pointer",
                                    transition: "background 0.1s",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}
                                onMouseEnter={(e) => {
                                    if (option.value !== value) e.currentTarget.style.background = "var(--bg-hover)";
                                }}
                                onMouseLeave={(e) => {
                                    if (option.value !== value) e.currentTarget.style.background = "transparent";
                                }}
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
                        <div style={{ padding: "0.75rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                            No options
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default Select;
