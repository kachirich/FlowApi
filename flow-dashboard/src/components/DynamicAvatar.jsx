import React from 'react';

export default function DynamicAvatar({ firstName = "", lastName = "", size = "md" }) {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  };

  const nameInitial = firstName ? firstName.charAt(0).toUpperCase() : (lastName ? lastName.charAt(0).toUpperCase() : "?");

  // Simple hash to consistently pick a color
  let hash = 0;
  const nameStr = firstName + lastName;
  for (let i = 0; i < nameStr.length; i++) {
    hash = nameStr.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    "bg-rose-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-fuchsia-500",
  ];
  
  const colorIndex = Math.abs(hash) % colors.length;
  const bgColor = nameStr ? colors[colorIndex] : "bg-zinc-700";

  return (
    <div className={`flex items-center justify-center rounded-full text-white font-bold tracking-tight shadow-md ${sizeClasses[size]} ${bgColor}`}>
      {nameInitial}
    </div>
  );
}
