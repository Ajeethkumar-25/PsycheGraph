import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Button = ({ className, children, ...props }) => {
    return (
        <button
            className={twMerge(
                'btn-primary flex items-center justify-center gap-2 cursor-pointer',
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
};
