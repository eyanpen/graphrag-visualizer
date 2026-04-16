declare module '*.json' {
    const value: any;
    export default value;
  }

declare module 'd3-force-3d' {
    export function forceX(x?: number): any;
    export function forceY(y?: number): any;
  }
  