import React from 'react';
import { twMerge } from 'tailwind-merge';

export const Input = ({ label, error, className, ...props }) => {
    return (
        <div className="w-full space-y-1.5">
            {label && (
                <label className="text-sm font-medium text-slate-400 ml-1">
                    {label}
                </label>
            )}
            <input
                className={twMerge(
                    'input-field',
                    error && 'border-accent-500/50 focus:border-accent-500/50 focus:ring-accent-500/10',
                    className
                )}
                {...props}
            />
            {error && (
                <span className="text-xs text-accent-500 ml-1 font-medium">
                    {error}
                </span>
            )}
        </div>
    );
};
