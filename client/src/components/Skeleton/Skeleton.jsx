import React from 'react';

/**
 * Skeleton shimmer block component.
 * @param {number}  width   - CSS width (e.g. "100%", 200). Default "100%"
 * @param {number|string} height  - CSS height (e.g. 16, "3rem"). Default 16
 * @param {string}  radius  - border-radius override (e.g. "50%", "8px")
 * @param {string}  className - extra class names
 */
const Skeleton = ({ width = '100%', height = 16, radius, className = '' }) => {
  return (
    <div
      className={`skeleton-block ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: radius || undefined,
      }}
      aria-hidden="true"
    />
  );
};

/** Pre-built skeleton for a service card */
export const ServiceCardSkeleton = () => (
  <div
    className="cp-service-card"
    style={{ gap: 14, pointerEvents: 'none' }}
    aria-hidden="true"
  >
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <Skeleton width={52} height={52} radius="14px" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton height={14} width="70%" />
        <Skeleton height={10} width="50%" />
      </div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Skeleton height={22} width="35%" />
      <Skeleton height={36} width="40%" radius="10px" />
    </div>
  </div>
);

/** Pre-built skeleton for an admin KPI card */
export const KpiCardSkeleton = () => (
  <div className="admin-kpi-card" style={{ pointerEvents: 'none' }} aria-hidden="true">
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
      <Skeleton width={42} height={42} radius="10px" />
      <Skeleton width={50} height={20} radius="999px" />
    </div>
    <Skeleton height={36} width="60%" style={{ marginBottom: 8 }} />
    <Skeleton height={12} width="45%" />
  </div>
);

export default Skeleton;
