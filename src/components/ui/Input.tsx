"use client";
import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-black placeholder-black/50 focus:outline-none focus:ring-2 focus:ring-indigo-600 ${className}`}
      {...props}
    />
  )
);
Input.displayName = "Input";

export default Input;
