import React, { useState, useRef, useMemo } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, ChevronRight, ChevronDown, Layers, Maximize2 } from 'lucide-react';

export interface VisualTreeNode {
  id: string;
  label: string;
  type?: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  details?: Record<string, any>;
  children?: VisualTreeNode[];
}

interface TreeVisualizerProps {
  root: VisualTreeNode;
  title?: string;
  onSelectNode?: (node: VisualTreeNode) => void;
  selectedNodeId?: string | null;
  height?: string;
  accentColor?: 'cyan' | 'indigo' | 'emerald' | 'amber' | 'violet';
}

interface LayoutNode {
  data: VisualTreeNode;
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
  children: LayoutNode[];
}

export const TreeVisualizer: React.FC<TreeVisualizerProps> = ({
  root,
  title,
  onSelectNode,
  selectedNodeId,
  height = '500px',
  accentColor = 'cyan'
}) => {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<VisualTreeNode | null>(root);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 30 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Compute layout coordinates for tree nodes
  const layout = useMemo(() => {
    const NODE_WIDTH = 210;
    const NODE_HEIGHT = 74;
    const HORIZONTAL_GAP = 36;
    const VERTICAL_GAP = 70;

    let minX = Infinity;
    let maxX = -Infinity;

    function buildLayout(node: VisualTreeNode, depth: number): LayoutNode {
      const isCollapsed = collapsedIds.has(node.id);
      const childLayouts: LayoutNode[] = [];

      if (!isCollapsed && node.children && node.children.length > 0) {
        for (const child of node.children) {
          childLayouts.push(buildLayout(child, depth + 1));
        }
      }

      return {
        data: node,
        x: 0,
        y: depth * (NODE_HEIGHT + VERTICAL_GAP),
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        collapsed: isCollapsed,
        children: childLayouts
      };
    }

    const layoutRoot = buildLayout(root, 0);

    // Compute horizontal positions
    let currentLeafX = 0;
    function positionX(node: LayoutNode) {
      if (node.children.length === 0) {
        node.x = currentLeafX;
        currentLeafX += NODE_WIDTH + HORIZONTAL_GAP;
      } else {
        node.children.forEach(positionX);
        const firstChild = node.children[0];
        const lastChild = node.children[node.children.length - 1];
        node.x = (firstChild.x + lastChild.x) / 2;
      }
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x + NODE_WIDTH);
    }

    positionX(layoutRoot);

    // Center root relative to canvas center
    const totalWidth = maxX - minX;
    const offsetX = -minX + 40;

    function applyOffset(node: LayoutNode) {
      node.x += offsetX;
      node.children.forEach(applyOffset);
    }
    applyOffset(layoutRoot);

    return { root: layoutRoot, totalWidth: totalWidth + 100 };
  }, [root, collapsedIds]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 30 });
  };

  const handleNodeClick = (node: VisualTreeNode) => {
    setSelectedNode(node);
    if (onSelectNode) {
      onSelectNode(node);
    }
  };

  // Color mapping based on node type
  const getNodeColor = (type?: string) => {
    switch (type) {
      case 'SelectStatement':
      case 'PROJECT':
        return 'border-cyan-500/60 bg-cyan-950/40 text-cyan-200';
      case 'TableReference':
      case 'TABLE_SCAN':
        return 'border-indigo-500/60 bg-indigo-950/40 text-indigo-200';
      case 'JoinClause':
      case 'JOIN':
        return 'border-violet-500/60 bg-violet-950/40 text-violet-200';
      case 'WhereClause':
      case 'SELECT':
      case 'BinaryExpression':
        return 'border-amber-500/60 bg-amber-950/40 text-amber-200';
      case 'GroupByClause':
      case 'AGGREGATE':
        return 'border-emerald-500/60 bg-emerald-950/40 text-emerald-200';
      case 'OrderByClause':
      case 'SORT':
        return 'border-rose-500/60 bg-rose-950/40 text-rose-200';
      default:
        return 'border-slate-700 bg-slate-900/80 text-slate-200';
    }
  };

  // Render SVG connecting lines between parent and child nodes
  const renderLinks = (node: LayoutNode): React.ReactNode[] => {
    const links: React.ReactNode[] = [];
    const parentBottomX = node.x + node.width / 2;
    const parentBottomY = node.y + node.height;

    for (const child of node.children) {
      const childTopX = child.x + child.width / 2;
      const childTopY = child.y;

      const deltaY = childTopY - parentBottomY;
      const path = `M ${parentBottomX} ${parentBottomY} C ${parentBottomX} ${parentBottomY + deltaY * 0.5}, ${childTopX} ${childTopY - deltaY * 0.5}, ${childTopX} ${childTopY}`;

      links.push(
        <path
          key={`link-${node.data.id}-${child.data.id}`}
          d={path}
          fill="none"
          stroke="rgba(100, 116, 139, 0.45)"
          strokeWidth="1.75"
          strokeDasharray={child.data.badge ? '4 2' : 'none'}
        />
      );

      links.push(...renderLinks(child));
    }

    return links;
  };

  // Render HTML node cards
  const renderNodes = (node: LayoutNode): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    const isSelected = (selectedNodeId && selectedNodeId === node.data.id) || selectedNode?.id === node.data.id;
    const hasChildren = node.data.children && node.data.children.length > 0;
    const colorClasses = getNodeColor(node.data.type);

    nodes.push(
      <div
        key={`node-${node.data.id}`}
        onClick={() => handleNodeClick(node.data)}
        style={{
          position: 'absolute',
          left: `${node.x}px`,
          top: `${node.y}px`,
          width: `${node.width}px`,
          height: `${node.height}px`
        }}
        className={`group cursor-pointer rounded-lg border p-2.5 transition-all select-none shadow-md ${colorClasses} ${
          isSelected ? 'ring-2 ring-cyan-400 border-cyan-400 bg-slate-900 shadow-cyan-500/20' : 'hover:border-slate-500'
        }`}
      >
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 truncate">
            {node.data.type || 'Node'}
          </span>
          <div className="flex items-center gap-1">
            {node.data.badge && (
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {node.data.badge}
              </span>
            )}
            {hasChildren && (
              <button
                onClick={(e) => toggleCollapse(node.data.id, e)}
                className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-white"
                title={node.collapsed ? 'Expand branch' : 'Collapse branch'}
              >
                {node.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-100 truncate" title={node.data.label}>
          {node.data.label}
        </div>

        {node.data.subtitle && (
          <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5" title={node.data.subtitle}>
            {node.data.subtitle}
          </div>
        )}
      </div>
    );

    if (!node.collapsed) {
      for (const child of node.children) {
        nodes.push(...renderNodes(child));
      }
    }

    return nodes;
  };

  return (
    <div className="relative flex flex-col rounded-xl border border-slate-800 bg-[#0c121e] overflow-hidden">
      {/* Visualizer Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/60 backdrop-blur text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <Layers size={14} className="text-cyan-400" />
          <span>{title || 'Visual Tree Representation'}</span>
          <span className="text-slate-500 font-normal">· Drag to pan, scroll to zoom</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(z => Math.min(z + 0.15, 2.2))}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(z - 0.15, 0.4))}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Reset Pan & Zoom"
          >
            <RotateCcw size={14} />
          </button>
          <span className="px-2 py-0.5 font-mono text-[11px] text-slate-400">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div
        ref={containerRef}
        style={{ height }}
        className="relative overflow-hidden cursor-grab active:cursor-grabbing bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={(e) => {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.08 : -0.08;
          setZoom(z => Math.min(Math.max(z + delta, 0.4), 2.2));
        }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: `${layout.totalWidth}px`,
            height: '1400px',
            position: 'absolute'
          }}
        >
          {/* SVG Links Layer */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible'
            }}
          >
            {renderLinks(layout.root)}
          </svg>

          {/* HTML Nodes Layer */}
          {renderNodes(layout.root)}
        </div>

        {/* Selected Node Inspector Drawer (Floating bottom right) */}
        {selectedNode && (
          <div className="absolute bottom-3 right-3 max-w-sm w-full bg-slate-900/95 border border-slate-700/80 rounded-lg p-3 shadow-xl backdrop-blur text-xs z-10 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="font-semibold text-slate-200">Node Inspector</span>
              </div>
              <span className="font-mono text-[10px] text-cyan-400">{selectedNode.type}</span>
            </div>

            <div className="space-y-1.5">
              <div>
                <span className="text-slate-400 text-[11px]">Label:</span>
                <span className="ml-1.5 font-medium text-slate-100">{selectedNode.label}</span>
              </div>
              {selectedNode.subtitle && (
                <div>
                  <span className="text-slate-400 text-[11px]">Parameter:</span>
                  <span className="ml-1.5 font-mono text-[11px] text-amber-300">{selectedNode.subtitle}</span>
                </div>
              )}
              {selectedNode.details && Object.keys(selectedNode.details).length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400 text-[10px] uppercase font-mono block mb-1">Attributes:</span>
                  <div className="bg-slate-950/80 rounded p-1.5 max-h-24 overflow-y-auto font-mono text-[10px] text-slate-300">
                    <pre>{JSON.stringify(selectedNode.details, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
