import React from 'react';

interface SENALogoProps {
  className?: string;
  color?: string;
}

export default function SENALogo({ className = "w-10 h-10", color = "currentColor" }: SENALogoProps) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className} 
      style={{ color }}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Circle - Head */}
      <circle cx="50" cy="11.5" r="10.5" />
      
      {/* SENA text */}
      <path d="M12 37.1c0-1.8.8-3.1 2.3-3.9 1.5-.8 3.5-1.2 5.9-1.2 2.3 0 4.2.4 5.6 1.1 1.4.7 2.1 1.8 2.1 3.2 0 .9-.3 1.6-.9 2.1-.6.5-1.5.9-2.7 1.2-1.7.4-2.5 1-2.5 1.9 0 .6.4 1 1.1 1.3.8.3 1.8.4 3.1.4h3.6V45H19.5c-2.3 0-4.1-.4-5.5-1.2-1.4-.8-2-2.1-2-3.7 0-.7.2-1.3.6-1.9.4-.6 1-1 1.8-1.4-.8-.3-1.4-.8-1.8-1.4-.4-.6-.6-1.3-.6-1.9zm5.3-.2c0 .4.2.7.5.9.3.2.9.3 1.8.3h2.3V35h-2.3c-.9 0-1.5.1-1.8.3-.3.2-.5.5-.5.9zM31.2 32.5h14.1v3.9H36.3v2h8.1v3.9h-8.1v2.1h9.3V45H31.2V32.5zm16.5 0h4.5l6.5 8.1V32.5h4.1V45h-4.3l-6.7-8.3V45h-4.1V32.5zm16.7 0h4.5l5.5 12.5h-4.4l-1-2.4h-5.2l-1 2.4h-4.4l6-12.5zm2 7.2L68 34.5l-1.9 5.2h3.9z" />
      
      {/* Horizontal Bar */}
      <rect x="0" y="48.5" width="100" height="7.5" rx="1" />
      
      {/* Outer Left Arm */}
      <path d="M 46 56 L 15 94 L 21.5 94 L 49.5 59.5 Z" />
      
      {/* Outer Right Arm */}
      <path d="M 54 56 L 85 94 L 78.5 94 L 50.5 59.5 Z" />
      
      {/* Central Inverted V (Legs) */}
      <path d="M 50 63 L 26 94 L 32.5 94 L 50 71.5 L 67.5 94 L 74 94 Z" />
    </svg>
  );
}
