import React, { ReactNode } from 'react';

interface TabButtonProps {
    isActive: boolean;
    onClick: () => void;
    children: ReactNode;
    icon?: ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({ isActive, onClick, children, icon }) => {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200
            ${isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
        >
            {icon}
            {children}
        </button>
    );
}

export default TabButton;
