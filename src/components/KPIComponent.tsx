import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp } from 'lucide-react';

export interface KPIProps {
  kpi: {
    label: string;
    value: string | number;
    color: string;
    trend?: string;
    description?: string;
  };
  index: number;
}

const KPIComponent = React.memo(({ kpi, index }: KPIProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="glass-card p-6 border-t-2"
      style={{ borderTopColor: kpi.color }}
    >
      <div className="flex flex-col">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-on-surface-variant/80 mb-2 font-headline">
          {kpi.label}
        </p>
        <h3 className="text-xl lg:text-2xl xl:text-3xl font-black font-headline text-on-surface break-words leading-tight">
          {kpi.value}
        </h3>
        {kpi.trend && (
          <div className="mt-3 text-[10px] font-bold text-primary flex items-center gap-1.5 bg-primary/10 w-fit px-2 py-0.5 rounded-full">
            <TrendingUp size={12} /> {kpi.trend}
          </div>
        )}
        {kpi.description && (
          <p className="mt-2 text-[10px] text-on-surface-variant/60 font-medium">
            {kpi.description}
          </p>
        )}
      </div>
    </motion.div>
  );
});

KPIComponent.displayName = 'KPIComponent';
export default KPIComponent;
