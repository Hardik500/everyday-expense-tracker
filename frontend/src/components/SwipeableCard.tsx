import React from "react";
import { useSwipeActions } from "../hooks/useSwipeActions";

interface SwipeAction {
  label: string;
  color: string;
  icon?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

interface SwipeableCardProps {
  children: React.ReactNode;
  actions: SwipeAction[];
  disabled?: boolean;
  className?: string;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
}

const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  actions,
  disabled = false,
  className = "",
  onSwipeStart,
  onSwipeEnd,
}) => {
  const { elementRef, translateX, swipedOpen, isSwiping, isClosing, maxSwipe } = useSwipeActions({
    actions,
    disabled: disabled || actions.length === 0,
    onSwipeStart,
    onSwipeEnd,
  });

  const transition = isSwiping ? "none" : "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";

  return (
    <div
      ref={elementRef}
      className={`swipeable-card ${className} ${swipedOpen ? "is-open" : ""} ${isClosing ? "is-closing" : ""}`}
      style={{
        position: "relative",
        overflow: "hidden",
        touchAction: "pan-y",
        userSelect: "none",
      }}
    >
      {/* Background actions layer */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "0 8px",
          gap: "4px",
          width: `${maxSwipe}px`,
          maxWidth: "100%",
          background: actions.length > 0 ? actions[actions.length - 1].color : "transparent",
          borderTopRightRadius: "var(--radius-md)",
          borderBottomRightRadius: "var(--radius-md)",
        }}
      >
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "70px",
              height: "100%",
              background: action.color,
              border: "none",
              borderRadius: index === 0 ? "0 var(--radius-md) var(--radius-md) 0" : "0",
              color: "#fff",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "opacity 0.2s ease",
              padding: "8px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {action.icon && (
              <div style={{ marginBottom: "4px" }}>{action.icon}</div>
            )}
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Foreground content layer */}
      <div
        style={{
          position: "relative",
          transform: `translateX(${translateX}px)`,
          transition,
          background: "var(--bg-card)",
          zIndex: 1,
          borderRadius: "var(--radius-md)",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableCard;
