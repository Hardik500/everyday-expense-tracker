import React from "react";
import { useSwipeActions } from "../../hooks/useSwipeActions";

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
  style?: React.CSSProperties;
}

const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  actions,
  disabled = false,
  className = "",
  onSwipeStart,
  onSwipeEnd,
  style,
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
      className={`swipeable-card relative overflow-hidden touch-pan-y select-none ${className} ${swipedOpen ? "is-open" : ""} ${isClosing ? "is-closing" : ""}`}
      style={style}
    >
      {/* Background actions layer */}
      <div
        className="absolute top-0 right-0 bottom-0 flex items-center justify-end px-2 gap-1"
        style={{
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
            className="flex flex-col items-center justify-center min-w-[70px] h-full bg-none border-none text-white text-xs font-medium cursor-pointer transition-opacity duration-200 p-2 hover:opacity-90"
            style={{
              background: action.color,
              borderRadius: index === 0 ? "0 var(--radius-md) var(--radius-md) 0" : "0",
            }}
          >
            {action.icon && <div className="mb-1">{action.icon}</div>}
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Foreground content layer */}
      <div
        className="relative bg-bg-card rounded-lg"
        style={{
          transform: `translateX(${translateX}px)`,
          transition,
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableCard;
