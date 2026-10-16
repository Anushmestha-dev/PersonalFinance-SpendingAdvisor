interface SkeletonProps {
  className?: string;
}

export const Skeleton = ({ className = '' }: SkeletonProps) => {
  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700/60 animate-pulse rounded-md ${className}`}
    />
  );
};

export const CardSkeleton = () => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
};

export const TableRowSkeleton = ({ columns = 5 }: { columns?: number }) => {
  return (
    <tr className="border-b dark:border-gray-700">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
};
