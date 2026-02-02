"use client";
import React from "react";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", ...props }, ref) => (
    <textarea
      ref={ref}
      className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-black placeholder-black/50 focus:outline-none focus:ring-2 focus:ring-indigo-600 ${className}`}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export default Textarea;
