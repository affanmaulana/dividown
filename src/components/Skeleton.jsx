import React from 'react';

const Skeleton = ({ className, variant = 'rect' }) => {
  const baseClasses = "animate-skeleton relative overflow-hidden";
  
  const variantClasses = {
    rect: "rounded-lg",
    circle: "rounded-full",
    text: "rounded h-4 w-full"
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />
  );
};

export default Skeleton;
