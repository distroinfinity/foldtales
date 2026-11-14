/**
 * Adapted from Magic UI's Shimmer Button (MIT, magicui.design): the one rust button, with a slow
 * gleam of lamplight across it. The gleam is CSS only and stops for reduced motion.
 */
import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import { cn } from './cn.ts';

export const ShimmerButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { gleam?: boolean }>(
  ({ className, children, gleam = true, ...props }, ref) => (
    <button
      ref={ref}
      style={{ '--spread': '80deg', '--shimmer-color': '#ffd98f', '--speed': '3.2s', '--cut': '0.08em', '--bg': 'var(--color-rust)' } as CSSProperties}
      className={cn(
        'group relative z-0 inline-flex min-h-16 cursor-pointer items-center justify-center overflow-hidden rounded-[10px] px-9 text-[22px] font-medium text-page [background:var(--bg)]',
        'shadow-[0_6px_0_var(--color-rust-deep),0_14px_28px_rgba(5,7,16,0.5)] transition-[transform,box-shadow] duration-150 active:translate-y-1 active:shadow-[0_2px_0_var(--color-rust-deep),0_8px_16px_rgba(5,7,16,0.45)]',
        'disabled:cursor-progress disabled:[--bg:#4a3f45] disabled:text-page/75 disabled:shadow-[0_6px_0_#2f282d,0_14px_28px_rgba(5,7,16,0.5)]',
        className,
      )}
      {...props}
    >
      {gleam && (
        <span aria-hidden className="absolute inset-0 -z-30 overflow-visible blur-[2px] @container-[size] motion-reduce:hidden">
          <span className="animate-shimmer-slide absolute inset-0 aspect-square h-[100cqh]">
            <span className="animate-spin-around absolute -inset-full [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
          </span>
        </span>
      )}
      {children}
      <span aria-hidden className="absolute inset-0 rounded-[10px] shadow-[inset_0_-8px_12px_rgba(255,240,210,0.12)]" />
      <span aria-hidden className="absolute inset-(--cut) -z-20 rounded-[10px] [background:var(--bg)]" />
    </button>
  ),
);
ShimmerButton.displayName = 'ShimmerButton';
