export default function RadiantPatches() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none hidden dark:block">
      {/* 1. Top-Left: Orange #F78D60 - Reduced opacity */}
      <div
        className="absolute -top-[150px] -left-[150px] w-[600px] h-[600px] opacity-[0.15] blur-[120px]"
        style={{
          background: "radial-gradient(circle, #F78D60 0%, transparent 70%)",
        }}
      />

      {/* 2. Top-Right Area: Pink #EA2264 - New Color */}
      <div
        className="absolute top-[15%] -right-[200px] w-[550px] h-[550px] opacity-[0.12] blur-[110px]"
        style={{
          background: "radial-gradient(circle, #EA2264 0%, transparent 70%)",
        }}
      />

      {/* 3. Middle-Left: Pink #EA2264 - Alternating side and color */}
      <div
        className="absolute top-[45%] -left-[200px] w-[550px] h-[550px] opacity-[0.12] blur-[110px]"
        style={{
          background: "radial-gradient(circle, #EA2264 0%, transparent 70%)",
        }}
      />

      {/* 4. Middle-Right: Orange #F78D60 - Alternating side and color */}
      <div
        className="absolute top-[65%] -right-[200px] w-[550px] h-[550px] opacity-[0.12] blur-[110px]"
        style={{
          background: "radial-gradient(circle, #F78D60 0%, transparent 70%)",
        }}
      />

      {/* 5. Bottom-Left: Orange #F78D60 */}
      <div
        className="absolute -bottom-[150px] -left-[150px] w-[600px] h-[600px] opacity-[0.15] blur-[120px]"
        style={{
          background: "radial-gradient(circle, #F78D60 0%, transparent 70%)",
        }}
      />

      {/* 6. Bottom-Right: Pink #EA2264 */}
      <div
        className="absolute -bottom-[150px] -right-[150px] w-[600px] h-[600px] opacity-[0.15] blur-[120px]"
        style={{
          background: "radial-gradient(circle, #EA2264 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
