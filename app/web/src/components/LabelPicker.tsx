import { useEffect, useRef, useState } from "react";
import { useLabelColors, setLabelColor, LABEL_PALETTE } from "../labels";
import { LinearIcon } from "./LinearIcon";

interface LabelPickerProps {
  availableLabels: string[];
  selectedLabels: string[];
  open: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName: string;
  showIcon?: boolean;
  placeholder?: string;
  onOpenChange: (open: boolean) => void;
  onChange: (labels: string[]) => void;
  onDeleteLabel?: (label: string) => Promise<void>;
}

export function LabelPicker({
  availableLabels,
  selectedLabels,
  open,
  disabled = false,
  className = "",
  triggerClassName,
  showIcon = false,
  placeholder = "标签",
  onOpenChange,
  onChange,
  onDeleteLabel,
}: LabelPickerProps) {
  const labelColor = useLabelColors();
  const [colorLabel, setColorLabel] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const normalizedSearch = search.trim();
  const visibleSelectedLabels = selectedLabels.filter((label) => label !== "想法池" && !label.startsWith("atlas-order:"));
  const filteredLabels = availableLabels.filter((label) => (
    !normalizedSearch || label.toLocaleLowerCase().includes(normalizedSearch.toLocaleLowerCase())
  ));
  const canCreateLabel = Boolean(normalizedSearch) && !availableLabels.includes(normalizedSearch);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setColorLabel(null);
      setPendingDelete(null);
      setDeleteError("");
      return;
    }

    function closeFromOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    }

    function closeFromEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeFromOutside);
    window.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      window.removeEventListener("keydown", closeFromEscape);
    };
  }, [onOpenChange, open]);

  function toggleLabel(label: string) {
    if (disabled) return;
    onChange(selectedLabels.includes(label)
      ? selectedLabels.filter((item) => item !== label)
      : [...selectedLabels, label]);
  }

  async function deleteLabel() {
    if (!pendingDelete || !onDeleteLabel) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDeleteLabel(pendingDelete);
      setPendingDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "删除标签失败。");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div ref={rootRef} className={`composer-menu-anchor label-picker${className ? ` ${className}` : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        disabled={disabled}
        aria-label="选择或创建标签"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        {showIcon && <LinearIcon name="label" />}
        <span>{visibleSelectedLabels.length > 0 ? visibleSelectedLabels.join(", ") : placeholder}</span>
      </button>
      {open && (
        <div className="composer-popover label-popover" role="dialog" aria-label="选择或创建标签">
          {!pendingDelete && !colorLabel && <>
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Add labels…"
            aria-label="搜索标签"
          />
          <div className="label-options" role="listbox" aria-label="可用标签" aria-multiselectable="true">
            {filteredLabels.map((label) => (
              <div className="label-option-row" key={label}>
                <button type="button" className="label-color-button" aria-label={`设置标签颜色 ${label}`} title="设置标签颜色" disabled={disabled || deleting} onClick={() => setColorLabel(label)}>
                  <i style={{ background: labelColor(label) }} />
                </button>
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedLabels.includes(label)}
                  disabled={disabled || deleting}
                  onClick={() => toggleLabel(label)}
                >
                  <span>{label}</span>
                  {selectedLabels.includes(label) && <b><LinearIcon name="check" /></b>}
                </button>
                {onDeleteLabel && label !== "想法池" && !label.startsWith("atlas-order:") && (
                  <button
                    className="label-delete-button"
                    type="button"
                    aria-label={`删除标签 ${label}`}
                    title={`从项目中删除标签 ${label}`}
                    disabled={disabled || deleting}
                    onClick={() => { setPendingDelete(label); setDeleteError(""); }}
                  ><LinearIcon name="trash" /></button>
                )}
              </div>
            ))}
            {canCreateLabel && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  toggleLabel(normalizedSearch);
                  setSearch("");
                }}
              >
                <i style={{ background: labelColor(normalizedSearch) }} />
                <span>创建 “{normalizedSearch}”</span>
              </button>
            )}
          </div>
          </>}
          {colorLabel && <div className="label-color-panel" aria-label="标签颜色">
            <p>“{colorLabel}”的颜色</p>
            <div className="label-color-palette">
              {LABEL_PALETTE.map(([name, color]) => <button key={color} type="button" aria-label={name} aria-pressed={labelColor(colorLabel) === color} style={{ background: color }} onClick={() => { setLabelColor(colorLabel, color); setColorLabel(null); }} />)}
            </div>
            <label>自定义颜色 <input type="color" aria-label="自定义标签颜色" value={labelColor(colorLabel)} onChange={(event) => setLabelColor(colorLabel, event.target.value)} /></label>
            <button type="button" onClick={() => setColorLabel(null)}>返回标签</button>
          </div>}
          {pendingDelete && <div className="label-delete-confirm" role="alertdialog" aria-label="删除标签">
            <p>从本项目所有任务中删除“{pendingDelete}”？</p>
            {deleteError && <p role="alert">{deleteError}</p>}
            <button type="button" disabled={deleting} onClick={() => setPendingDelete(null)}>取消</button>
            <button type="button" disabled={deleting} onClick={() => void deleteLabel()}>{deleting ? "删除中…" : "删除标签"}</button>
          </div>}
        </div>
      )}
    </div>
  );
}
