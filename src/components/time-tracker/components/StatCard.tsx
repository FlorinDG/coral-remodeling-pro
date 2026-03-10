"use client";
import { LucideIcon } from 'lucide-react';

type StatVariant = 'primary' | 'secondary' | 'destructive' | 'muted';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: StatVariant;
}

const variantStyles: Record<StatVariant, string> = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
  muted: 'bg-muted text-muted-foreground',
};

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = 'primary' }: StatCardProps) {
  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${variantStyles[variant]} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className={`text-sm font-medium ${trend.isPositive ? 'text-secondary' : 'text-destructive'}`}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
