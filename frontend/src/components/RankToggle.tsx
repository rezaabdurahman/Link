import React from 'react';

type SortOption = 'priority' | 'time' | 'unread';

interface RankToggleProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const RankToggle: React.FC<RankToggleProps> = ({ value, onChange }): JSX.Element => {
  const options: { value: SortOption; label: string }[] = [
    { value: 'priority', label: 'Priority' },
    { value: 'time', label: 'Recent' },
    { value: 'unread', label: 'Unread' }
  ];

  return (
    <div className="flex bg-surface-hover/30 rounded-lg p-1 gap-1" data-testid="rank-toggle">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
            value === option.value
              ? 'bg-aqua text-white shadow-sm'
              : 'text-text-secondary hover:text-white hover:bg-surface-hover/50'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default RankToggle;
