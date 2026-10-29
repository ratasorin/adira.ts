import { expectSuccess } from "../../../../services/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addToast, Button, Checkbox, Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, } from "@heroui/react";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import DiscountOutlined from "@mui/icons-material/DiscountOutlined";
import FunctionsRoundedIcon from "@mui/icons-material/FunctionsRounded";
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import { Languages } from "lucide-react";
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "../../../../services/api";
import { displayError } from "../../../../utils/handle-error";
import { displayCurrency } from "../../../../utils/prices";
import type { VIEW_MODE } from "../../invoice.types";
import { ProductLine } from "../products/select-products";
import { Tooltip } from "@heroui/tooltip";
import { fetchModifierViewerTranslations, ModifierViewerTranslation, saveModifierViewerTranslation, translateModifierViewerLabel, } from "./modifier-viewer-translations.api";
import { ModifierBlueprint, OperationLine, TranslationDisplayState, useInvoiceOperations, ViewerBlueprint, } from "../../store/operations";
import { Currency } from "@monefy/types/src/models/Product";
type InitialModifierLine = {
    _id: string;
    index: number;
    targetProductLine?: string[];
    modifier: ModifierBlueprint | string | null | undefined;
};
type InitialViewerLine = {
    _id: string;
    index: number;
    subtotal?: number;
    currency?: Currency;
    viewer: ViewerBlueprint | string | null | undefined;
};
type Props = {
    viewMode: VIEW_MODE;
    productLines: ProductLine[];
    initialModifierLines?: InitialModifierLine[];
    initialViewerLines?: InitialViewerLine[];
    netTotal: number;
    netCurrency: Currency;
    selectedLanguageCode?: string;
    selectedLanguageName?: string;
};
type ModifierForm = {
    name: string;
    scope: "line" | "total";
    type: "percentage" | "fixed";
    operation: "add" | "subtract";
    value: number;
    currency?: Currency;
    targetProductLine: string[];
};
const fetchModifiers = async () => {
    const { run } = api("/modifiers", "GET")({
        query: {include: [], 
            rows: r => r({
                select: [] as []
            })
        },
    });
    return run().then(expectSuccess).then((res) => res?.rows);
};
const fetchViewers = async () => {
    const { run } = api("/viewers", "GET")({
        query: {include: [],  rows: r => r({
                select: [] as []
            }) },
    });
    return run().then(expectSuccess).then((res) => res?.rows as ViewerBlueprint[] | undefined);
};
const createModifier = async (payload: Omit<ModifierBlueprint, "_id">) => {
    const { run } = api("/modifiers", "POST")({
        data: payload,
        query: {include: [], 
            rows: r => r({
                select: [] as []
            })
        },
    });
    return run().then(expectSuccess).then((res) => res);
};
const createViewer = async (payload: Omit<ViewerBlueprint, "_id">) => {
    const { run } = api("/viewers", "POST")({
        data: payload,
        query: {include: [], 
            rows: r => r({
                select: [] as []
            })
        },
    });
    return run().then(expectSuccess).then((res) => res);
};
const isNonEmptyId = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const DEFAULT_SOURCE_LANGUAGE_CODE = "en";
const isBaseLanguage = (languageCode?: string) => !languageCode || languageCode === DEFAULT_SOURCE_LANGUAGE_CODE;
// Helper function to create a key for grouping modifiers
const getModifierKey = (modifier: ModifierBlueprint): string => `${modifier.name}|${modifier.scope}|${modifier.type}|${modifier.operation}|${modifier.value}`;
type GroupedModifiers = {
    key: string;
    modifiers: ModifierBlueprint[];
    hasMultipleCurrencies: boolean;
    currencies: Currency[];
};
const normalizeModifierBlueprint = (modifier: ModifierBlueprint): ModifierBlueprint => {
    const baseModifier = { ...modifier };
    delete baseModifier.displayName;
    delete baseModifier.translationLanguageCode;
    delete baseModifier.isMissingTranslation;
    return {
        ...baseModifier,
        translationDraft: modifier.translationDraft || "",
        isSavingTranslation: Boolean(modifier.isSavingTranslation),
        isEditingTranslation: Boolean(modifier.isEditingTranslation),
        isLoadingTranslationDraft: Boolean(modifier.isLoadingTranslationDraft),
    };
};
const normalizeViewerBlueprint = (viewer: ViewerBlueprint): ViewerBlueprint => {
    const baseViewer = { ...viewer };
    delete baseViewer.displayName;
    delete baseViewer.translationLanguageCode;
    delete baseViewer.isMissingTranslation;
    return {
        ...baseViewer,
        translationDraft: viewer.translationDraft || "",
        isSavingTranslation: Boolean(viewer.isSavingTranslation),
        isEditingTranslation: Boolean(viewer.isEditingTranslation),
        isLoadingTranslationDraft: Boolean(viewer.isLoadingTranslationDraft),
    };
};
const getModifierTranslationPatch = (modifier: Pick<ModifierBlueprint, "name">, translation: ModifierViewerTranslation | undefined, languageCode?: string): TranslationDisplayState => ({
    displayName: translation?.text?.trim() || modifier.name,
    translationLanguageCode: languageCode || undefined,
    isMissingTranslation: !isBaseLanguage(languageCode) && !translation?.text?.trim(),
});
const getViewerTranslationPatch = (viewer: Pick<ViewerBlueprint, "name">, translation: ModifierViewerTranslation | undefined, languageCode?: string): TranslationDisplayState => ({
    displayName: translation?.text?.trim() || viewer.name,
    translationLanguageCode: languageCode || undefined,
    isMissingTranslation: !isBaseLanguage(languageCode) && !translation?.text?.trim(),
});
const buildTranslationMap = (rows: ModifierViewerTranslation[]) => new Map(rows.map((row) => [row.entity_id, row]));
const SortableRow = ({ row, viewMode, onRemove, selectedLanguageCode, selectedLanguageName, onStartTranslationEdit, onTranslationDraftChange, onCancelTranslationEdit, onSaveTranslation, displayName, isMissingTranslation, }: {
    row: OperationLine;
    viewMode: VIEW_MODE;
    onRemove: (id: string) => void;
    selectedLanguageCode?: string;
    selectedLanguageName?: string;
    onStartTranslationEdit: (row: OperationLine) => void;
    onTranslationDraftChange: (row: OperationLine, value: string) => void;
    onCancelTranslationEdit: (row: OperationLine) => void;
    onSaveTranslation: (row: OperationLine) => void;
    displayName: string;
    isMissingTranslation: boolean;
}) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
        id: row._id,
        disabled: viewMode === "read",
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    const entity = row.kind === "modifier" ? row.modifier : row.viewer;
    const title = displayName || entity.name;
    const canTranslate = viewMode !== "read" && !isBaseLanguage(selectedLanguageCode);
    const details = row.kind === "modifier"
        ? `${row.modifier.operation === "add" ? "+" : "-"} ${row.modifier.value}${row.modifier.type === "percentage" ? "%" : displayCurrency(row.modifier.currency!)} • ${row.modifier.scope}`
        : row.subtotal !== undefined && row.currency !== undefined
            ? `${row.subtotal}${displayCurrency(row.currency)} snapshot`
            : "Viewer snapshot";
    return (<div ref={setNodeRef} style={style} className="rounded-xl border border-default-200 bg-content1 px-3 py-3 flex gap-3 flex-col-reverse">
      {isBaseLanguage(selectedLanguageCode) ||
            (entity.isEditingTranslation && (<div className="mt-1">
            <div className="flex items-center gap-2">
              <Input size="sm" value={entity.translationDraft || ""} onChange={(event) => onTranslationDraftChange(row, event.target.value)} isDisabled={entity.isSavingTranslation} placeholder={`Translation for ${selectedLanguageName || selectedLanguageCode || "language"}`}/>
              <Button size="sm" color="secondary" isLoading={entity.isSavingTranslation} isDisabled={!entity.translationDraft?.trim() ||
                    entity.isLoadingTranslationDraft} onPress={() => onSaveTranslation(row)}>
                Save
              </Button>
              <Button size="sm" variant="light" isDisabled={entity.isSavingTranslation} onPress={() => onCancelTranslationEdit(row)}>
                Cancel
              </Button>
            </div>
          </div>))}
      <div style={style} className="grid grid-cols-[32px_minmax(0,1.2fr)_minmax(0,1fr)_120px_88px] items-center gap-3">
        <button type="button" aria-label="Reorder row" className="text-default-400 disabled:cursor-default" disabled={viewMode === "read"} {...attributes} {...listeners}>
          <DragIndicatorRoundedIcon fontSize="small"/>
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className="truncate font-medium flex flex-col">
              {title}
              <span className={`text-xs font-normal whitespace-normal ${isMissingTranslation ? "text-warning-700" : "text-default-400"}`}>
                {isMissingTranslation
            ? `Missing translation for ${selectedLanguageName ||
                selectedLanguageCode ||
                "selected language"}`
            : `Localized for ${selectedLanguageName ||
                selectedLanguageCode ||
                "selected language"}`}
              </span>
            </p>
            {isMissingTranslation ? (<Tooltip color="warning" content={`Click to add translation for ${selectedLanguageName ||
                selectedLanguageCode ||
                "selected language"}`}>
                <button type="button" aria-label={`Add translation for ${selectedLanguageName ||
                selectedLanguageCode ||
                "selected language"}`} className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning text-warning-contrast-text text-[10px] font-bold transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-100" disabled={!canTranslate} onClick={() => onStartTranslationEdit(row)}>
                  !
                </button>
              </Tooltip>) : null}
          </div>
        </div>
        <div className="min-w-0 text-sm text-default-500">{details}</div>
        <div className="text-sm uppercase text-default-500">{row.kind}</div>
        <div className="flex justify-end gap-1">
          <Tooltip content={`Edit translation for ${selectedLanguageName ||
            selectedLanguageCode ||
            "selected language"}`}>
            <Button isIconOnly size="sm" variant="light" isDisabled={!canTranslate} onPress={() => onStartTranslationEdit(row)}>
              <Languages size={16}/>
            </Button>
          </Tooltip>
          <Button isIconOnly size="sm" variant="light" color="danger" isDisabled={viewMode === "read"} onPress={() => onRemove(row._id)}>
            <DeleteOutlineRoundedIcon fontSize="small"/>
          </Button>
        </div>
      </div>
    </div>);
};
export default function ModifiersViewersTable({ viewMode, productLines, initialModifierLines, initialViewerLines, netTotal, netCurrency, selectedLanguageCode, selectedLanguageName, }: Props) {
    const [availableModifiers, setAvailableModifiers] = useState<ModifierBlueprint[]>([]);
    const [availableViewers, setAvailableViewers] = useState<ViewerBlueprint[]>([]);
    const rows = useInvoiceOperations((state) => state.rows);
    const modifierDisplayById = useInvoiceOperations((state) => state.modifierDisplayById);
    const viewerDisplayById = useInvoiceOperations((state) => state.viewerDisplayById);
    const init = useInvoiceOperations((state) => state.init);
    const insertModifierLine = useInvoiceOperations((state) => state.insertModifier);
    const insertViewerLine = useInvoiceOperations((state) => state.insertViewer);
    const patchModifierBlueprints = useInvoiceOperations((state) => state.patchModifierBlueprints);
    const patchViewerBlueprints = useInvoiceOperations((state) => state.patchViewerBlueprints);
    const setModifierDisplayStates = useInvoiceOperations((state) => state.setModifierDisplayStates);
    const setViewerDisplayStates = useInvoiceOperations((state) => state.setViewerDisplayStates);
    const patchModifierDisplayState = useInvoiceOperations((state) => state.patchModifierDisplayState);
    const patchViewerDisplayState = useInvoiceOperations((state) => state.patchViewerDisplayState);
    const removeRow = useInvoiceOperations((state) => state.remove);
    const reorderRows = useInvoiceOperations((state) => state.reorder);
    const [isAddModifierOpen, setIsAddModifierOpen] = useState(false);
    const [isCreateModifierOpen, setIsCreateModifierOpen] = useState(false);
    const [isAddViewerOpen, setIsAddViewerOpen] = useState(false);
    const [isCreateViewerOpen, setIsCreateViewerOpen] = useState(false);
    const [selectedModifierId, setSelectedModifierId] = useState<string>("");
    const [selectedViewerId, setSelectedViewerId] = useState<string>("");
    const [newViewerName, setNewViewerName] = useState("");
    const [modifierForm, setModifierForm] = useState<ModifierForm>({
        name: "",
        scope: "total",
        type: "percentage",
        operation: "add",
        value: 0,
        currency: undefined,
        targetProductLine: [],
    });
    useEffect(() => {
        fetchModifiers()
            .then((data) => setAvailableModifiers((data || []).map((modifier) => normalizeModifierBlueprint(modifier as ModifierBlueprint))))
            .catch((error) => displayError(error, "[Error] Cannot fetch modifiers!"));
        fetchViewers()
            .then((data) => setAvailableViewers((data || []).map((viewer) => normalizeViewerBlueprint(viewer as ViewerBlueprint))))
            .catch((error) => displayError(error, "[Error] Cannot fetch viewers!"));
        return () => {
            init([]);
        };
    }, [init]);
    useEffect(() => {
        const hydratedRows: OperationLine[] = [];
        for (const line of initialModifierLines || []) {
            if (line.modifier && typeof line.modifier !== "string") {
                hydratedRows.push({
                    _id: line._id,
                    kind: "modifier",
                    modifier: normalizeModifierBlueprint(line.modifier),
                    index: line.index,
                    targetProductLine: line.targetProductLine || [],
                });
            }
        }
        for (const line of initialViewerLines || []) {
            if (line.viewer && typeof line.viewer !== "string") {
                hydratedRows.push({
                    _id: line._id,
                    kind: "viewer",
                    viewer: normalizeViewerBlueprint(line.viewer),
                    index: line.index,
                    subtotal: line.subtotal,
                    currency: line.currency,
                });
            }
        }
        init(hydratedRows);
    }, [init, initialModifierLines, initialViewerLines]);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
    const validProductRows = useMemo(() => productLines.filter((line) => isNonEmptyId(line._id) && isNonEmptyId(line.product?._id)), [productLines]);
    const hasProductRows = validProductRows.length > 0;
    const canManageModifiers = viewMode !== "read" && hasProductRows;
    const selectedModifier = useMemo(() => availableModifiers.find((modifier) => modifier._id === selectedModifierId), [availableModifiers, selectedModifierId]);
    console.log({ availableModifiers });
    // Group modifiers by their key (name, scope, type, operation, value)
    const groupedModifiers = useMemo(() => {
        const groups: Record<string, GroupedModifiers> = {};
        for (const modifier of availableModifiers) {
            const key = getModifierKey(modifier);
            if (!groups[key]) {
                groups[key] = {
                    key,
                    modifiers: [],
                    hasMultipleCurrencies: false,
                    currencies: [],
                };
            }
            groups[key].modifiers.push(modifier);
            if (modifier.currency &&
                !groups[key].currencies.includes(modifier.currency)) {
                groups[key].currencies.push(modifier.currency);
            }
        }
        // Check for multiple currencies in each group
        for (const group of Object.values(groups)) {
            group.hasMultipleCurrencies =
                group.modifiers.length > 1 &&
                    group.modifiers.every((m) => m.currency) &&
                    group.currencies.length > 1;
        }
        return Object.values(groups);
    }, [availableModifiers]);
    const modifierEntityIds = useMemo(() => Array.from(new Set([
        ...availableModifiers.map((modifier) => modifier._id),
        ...rows
            .filter((row): row is Extract<OperationLine, {
            kind: "modifier";
        }> => row.kind === "modifier")
            .map((row) => row.modifier._id),
    ])), [availableModifiers, rows]);
    const viewerEntityIds = useMemo(() => Array.from(new Set([
        ...availableViewers.map((viewer) => viewer._id),
        ...rows
            .filter((row): row is Extract<OperationLine, {
            kind: "viewer";
        }> => row.kind === "viewer")
            .map((row) => row.viewer._id),
    ])), [availableViewers, rows]);
    const modifierEntityIdsKey = useMemo(() => modifierEntityIds.join(","), [modifierEntityIds]);
    const viewerEntityIdsKey = useMemo(() => viewerEntityIds.join(","), [viewerEntityIds]);
    const modifierBaseNameById = useMemo(() => Object.fromEntries([
        ...availableModifiers.map((modifier) => [modifier._id, modifier.name] as const),
        ...rows
            .filter((row): row is Extract<OperationLine, {
            kind: "modifier";
        }> => row.kind === "modifier")
            .map((row) => [row.modifier._id, row.modifier.name] as const),
    ].filter(([id]) => isNonEmptyId(id))), [availableModifiers, rows]);
    const viewerBaseNameById = useMemo(() => Object.fromEntries([
        ...availableViewers.map((viewer) => [viewer._id, viewer.name] as const),
        ...rows
            .filter((row): row is Extract<OperationLine, {
            kind: "viewer";
        }> => row.kind === "viewer")
            .map((row) => [row.viewer._id, row.viewer.name] as const),
    ].filter(([id]) => isNonEmptyId(id))), [availableViewers, rows]);
    const modifierBaseNamesKey = useMemo(() => Object.entries(modifierBaseNameById)
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
        .map(([id, name]) => `${id}:${name}`)
        .join("|"), [modifierBaseNameById]);
    const viewerBaseNamesKey = useMemo(() => Object.entries(viewerBaseNameById)
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
        .map(([id, name]) => `${id}:${name}`)
        .join("|"), [viewerBaseNameById]);
    useEffect(() => {
        const modifierIds = modifierEntityIdsKey
            ? modifierEntityIdsKey.split(",").filter(Boolean)
            : [];
        const viewerIds = viewerEntityIdsKey
            ? viewerEntityIdsKey.split(",").filter(Boolean)
            : [];
        if (!selectedLanguageCode || isBaseLanguage(selectedLanguageCode)) {
            setModifierDisplayStates(Object.fromEntries(modifierIds.map((modifierId) => [
                modifierId,
                {
                    displayName: modifierBaseNameById[modifierId] || "",
                    translationLanguageCode: selectedLanguageCode || undefined,
                    isMissingTranslation: false,
                },
            ])));
            setViewerDisplayStates(Object.fromEntries(viewerIds.map((viewerId) => [
                viewerId,
                {
                    displayName: viewerBaseNameById[viewerId] || "",
                    translationLanguageCode: selectedLanguageCode || undefined,
                    isMissingTranslation: false,
                },
            ])));
            return;
        }
        let cancelled = false;
        Promise.all([
            fetchModifierViewerTranslations({
                entityType: "modifier",
                entityIds: modifierIds,
                languageCode: selectedLanguageCode,
            }),
            fetchModifierViewerTranslations({
                entityType: "viewer",
                entityIds: viewerIds,
                languageCode: selectedLanguageCode,
            }),
        ])
            .then(([modifierTranslations, viewerTranslations]) => {
            if (cancelled)
                return;
            const modifierTranslationMap = buildTranslationMap(modifierTranslations);
            const viewerTranslationMap = buildTranslationMap(viewerTranslations);
            setModifierDisplayStates(Object.fromEntries(modifierIds.map((modifierId) => [
                modifierId,
                getModifierTranslationPatch({ name: modifierBaseNameById[modifierId] || "" }, modifierTranslationMap.get(modifierId), selectedLanguageCode),
            ])));
            setViewerDisplayStates(Object.fromEntries(viewerIds.map((viewerId) => [
                viewerId,
                getViewerTranslationPatch({ name: viewerBaseNameById[viewerId] || "" }, viewerTranslationMap.get(viewerId), selectedLanguageCode),
            ])));
        })
            .catch((error) => displayError(error, "[Error] Cannot load modifier/viewer translations!"));
        return () => {
            cancelled = true;
        };
    }, [
        modifierEntityIdsKey,
        modifierBaseNamesKey,
        selectedLanguageCode,
        setModifierDisplayStates,
        setViewerDisplayStates,
        viewerBaseNamesKey,
        viewerEntityIdsKey,
        modifierBaseNameById,
        viewerBaseNameById,
    ]);
    const getModifierDisplayName = useCallback((modifier: ModifierBlueprint) => modifierDisplayById[modifier._id]?.displayName || modifier.name, [modifierDisplayById]);
    const getViewerDisplayName = useCallback((viewer: ViewerBlueprint) => viewerDisplayById[viewer._id]?.displayName || viewer.name, [viewerDisplayById]);
    const patchModifierEverywhere = useCallback((modifierId: string, patch: Partial<ModifierBlueprint>) => {
        patchModifierBlueprints({ [modifierId]: patch });
        setAvailableModifiers((current) => current.map((modifier) => modifier._id === modifierId ? { ...modifier, ...patch } : modifier));
    }, [patchModifierBlueprints]);
    const patchViewerEverywhere = useCallback((viewerId: string, patch: Partial<ViewerBlueprint>) => {
        patchViewerBlueprints({ [viewerId]: patch });
        setAvailableViewers((current) => current.map((viewer) => viewer._id === viewerId ? { ...viewer, ...patch } : viewer));
    }, [patchViewerBlueprints]);
    const handleTranslationDraftChange = useCallback((row: OperationLine, value: string) => {
        if (row.kind === "modifier") {
            patchModifierEverywhere(row.modifier._id, { translationDraft: value });
        }
        else {
            patchViewerEverywhere(row.viewer._id, { translationDraft: value });
        }
    }, [patchModifierEverywhere, patchViewerEverywhere]);
    const handleCancelTranslationEdit = useCallback((row: OperationLine) => {
        if (row.kind === "modifier") {
            patchModifierEverywhere(row.modifier._id, {
                isEditingTranslation: false,
                isLoadingTranslationDraft: false,
                translationDraft: getModifierDisplayName(row.modifier),
            });
        }
        else {
            patchViewerEverywhere(row.viewer._id, {
                isEditingTranslation: false,
                isLoadingTranslationDraft: false,
                translationDraft: getViewerDisplayName(row.viewer),
            });
        }
    }, [
        getModifierDisplayName,
        getViewerDisplayName,
        patchModifierEverywhere,
        patchViewerEverywhere,
    ]);
    const handleStartTranslationEdit = useCallback(async (row: OperationLine) => {
        if (!selectedLanguageCode || isBaseLanguage(selectedLanguageCode))
            return;
        if ((row.kind === "modifier" && row.modifier.isEditingTranslation) ||
            (row.kind === "viewer" && row.viewer.isEditingTranslation)) {
            handleCancelTranslationEdit(row);
            return;
        }
        if (row.kind === "modifier") {
            patchModifierEverywhere(row.modifier._id, {
                isEditingTranslation: true,
                translationDraft: row.modifier.translationDraft ||
                    getModifierDisplayName(row.modifier),
            });
            if (modifierDisplayById[row.modifier._id]?.isMissingTranslation) {
                patchModifierEverywhere(row.modifier._id, {
                    isLoadingTranslationDraft: true,
                });
                try {
                    const translated = await translateModifierViewerLabel({
                        text: row.modifier.name,
                        sourceLanguageCode: DEFAULT_SOURCE_LANGUAGE_CODE,
                        targetLanguageCode: selectedLanguageCode,
                    });
                    patchModifierEverywhere(row.modifier._id, {
                        translationDraft: translated.text,
                    });
                }
                catch (error) {
                    displayError(error, "[Error] Cannot prefill modifier translation!");
                }
                finally {
                    patchModifierEverywhere(row.modifier._id, {
                        isLoadingTranslationDraft: false,
                    });
                }
            }
        }
        else {
            patchViewerEverywhere(row.viewer._id, {
                isEditingTranslation: true,
                translationDraft: row.viewer.translationDraft || getViewerDisplayName(row.viewer),
            });
            if (viewerDisplayById[row.viewer._id]?.isMissingTranslation) {
                patchViewerEverywhere(row.viewer._id, {
                    isLoadingTranslationDraft: true,
                });
                try {
                    const translated = await translateModifierViewerLabel({
                        text: row.viewer.name,
                        sourceLanguageCode: DEFAULT_SOURCE_LANGUAGE_CODE,
                        targetLanguageCode: selectedLanguageCode,
                    });
                    patchViewerEverywhere(row.viewer._id, {
                        translationDraft: translated.text,
                    });
                }
                catch (error) {
                    displayError(error, "[Error] Cannot prefill viewer translation!");
                }
                finally {
                    patchViewerEverywhere(row.viewer._id, {
                        isLoadingTranslationDraft: false,
                    });
                }
            }
        }
    }, [
        getModifierDisplayName,
        getViewerDisplayName,
        handleCancelTranslationEdit,
        modifierDisplayById,
        patchModifierEverywhere,
        patchViewerEverywhere,
        selectedLanguageCode,
        viewerDisplayById,
    ]);
    const handleSaveTranslation = useCallback(async (row: OperationLine) => {
        if (!selectedLanguageCode || isBaseLanguage(selectedLanguageCode))
            return;
        if (row.kind === "modifier") {
            const text = row.modifier.translationDraft?.trim();
            if (!text)
                return;
            patchModifierEverywhere(row.modifier._id, {
                isSavingTranslation: true,
            });
            try {
                await saveModifierViewerTranslation({
                    entityType: "modifier",
                    entityId: row.modifier._id,
                    languageCode: selectedLanguageCode,
                    text,
                });
                patchModifierDisplayState(row.modifier._id, {
                    displayName: text,
                    translationLanguageCode: selectedLanguageCode,
                    isMissingTranslation: false,
                });
                patchModifierEverywhere(row.modifier._id, {
                    translationDraft: text,
                    isEditingTranslation: false,
                });
                addToast({
                    color: "success",
                    title: "Modifier translation saved",
                });
            }
            catch (error) {
                displayError(error, "[Error] Cannot save modifier translation!");
            }
            finally {
                patchModifierEverywhere(row.modifier._id, {
                    isSavingTranslation: false,
                });
            }
        }
        else {
            const text = row.viewer.translationDraft?.trim();
            if (!text)
                return;
            patchViewerEverywhere(row.viewer._id, { isSavingTranslation: true });
            try {
                await saveModifierViewerTranslation({
                    entityType: "viewer",
                    entityId: row.viewer._id,
                    languageCode: selectedLanguageCode,
                    text,
                });
                patchViewerDisplayState(row.viewer._id, {
                    displayName: text,
                    translationLanguageCode: selectedLanguageCode,
                    isMissingTranslation: false,
                });
                patchViewerEverywhere(row.viewer._id, {
                    translationDraft: text,
                    isEditingTranslation: false,
                });
                addToast({
                    color: "success",
                    title: "Viewer translation saved",
                });
            }
            catch (error) {
                displayError(error, "[Error] Cannot save viewer translation!");
            }
            finally {
                patchViewerEverywhere(row.viewer._id, {
                    isSavingTranslation: false,
                });
            }
        }
    }, [
        patchModifierDisplayState,
        patchModifierEverywhere,
        patchViewerDisplayState,
        patchViewerEverywhere,
        selectedLanguageCode,
    ]);
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id)
            return;
        reorderRows(String(active.id), String(over.id));
    };
    // Get the group for the selected modifier (to check if it has multiple currencies)
    const selectedModifierGroup = useMemo(() => {
        if (!selectedModifier)
            return null;
        return groupedModifiers.find((group) => group.modifiers.some((m) => m._id === selectedModifier._id));
    }, [selectedModifier, groupedModifiers]);
    useEffect(() => {
        if (!selectedModifierId || !selectedModifierGroup?.hasMultipleCurrencies) {
            setModifierForm((current) => current.currency ? { ...current, currency: undefined } : current);
            return;
        }
        const defaultCurrency = selectedModifier?.currency || selectedModifierGroup.currencies[0];
        if (!defaultCurrency)
            return;
        setModifierForm((current) => current.currency &&
            selectedModifierGroup.currencies.includes(current.currency)
            ? current
            : { ...current, currency: defaultCurrency });
    }, [selectedModifier?.currency, selectedModifierGroup, selectedModifierId]);
    const addExistingModifier = () => {
        if (!canManageModifiers)
            return;
        if (!selectedModifier)
            return;
        if (selectedModifier.scope === "line" &&
            modifierForm.targetProductLine.length === 0) {
            addToast({
                color: "warning",
                title: "Select at least one product",
            });
            return;
        }
        // If modifier has multiple currencies, use the selected currency
        if (selectedModifierGroup?.hasMultipleCurrencies && modifierForm.currency) {
            const modifierWithCurrency = selectedModifierGroup.modifiers.find((m) => m.currency === modifierForm.currency);
            if (modifierWithCurrency) {
                insertModifierLine({
                    modifier: modifierWithCurrency,
                    targetProductLine: modifierWithCurrency.scope === "line"
                        ? modifierForm.targetProductLine
                        : undefined,
                });
            }
        }
        else {
            insertModifierLine({
                modifier: selectedModifier,
                targetProductLine: selectedModifier.scope === "line"
                    ? modifierForm.targetProductLine
                    : undefined,
            });
        }
        setSelectedModifierId("");
        setModifierForm((current) => ({
            ...current,
            currency: undefined,
            targetProductLine: [],
        }));
        setIsAddModifierOpen(false);
    };
    const addExistingViewer = () => {
        const viewer = availableViewers.find((item) => item._id === selectedViewerId);
        if (!viewer)
            return;
        insertViewerLine({ viewer });
        setSelectedViewerId("");
        setIsAddViewerOpen(false);
    };
    const handleCreateModifier = async () => {
        if (!canManageModifiers)
            return;
        if (!modifierForm.name.trim())
            return;
        if (modifierForm.scope === "line" &&
            modifierForm.targetProductLine.length === 0) {
            addToast({
                color: "warning",
                title: "Select at least one product",
            });
            return;
        }
        if (modifierForm.type === "fixed" && !modifierForm.currency) {
            addToast({
                color: "warning",
                title: "Select a currency for fixed modifier",
            });
            return;
        }
        try {
            const created = await createModifier({
                name: modifierForm.name.trim(),
                scope: modifierForm.scope,
                type: modifierForm.type,
                operation: modifierForm.operation,
                value: modifierForm.value,
                currency: modifierForm.type === "fixed" ? modifierForm.currency : undefined,
            });
            if (!created)
                return;
            const normalizedCreated = normalizeModifierBlueprint(created as ModifierBlueprint);
            setAvailableModifiers((current) => [...current, normalizedCreated]);
            insertModifierLine({
                modifier: normalizedCreated,
                targetProductLine: created.scope === "line" ? modifierForm.targetProductLine : undefined,
            });
            setModifierForm({
                name: "",
                scope: "total",
                type: "percentage",
                operation: "add",
                value: 0,
                currency: undefined,
                targetProductLine: [],
            });
            setIsCreateModifierOpen(false);
        }
        catch (error) {
            displayError(error, "[Error] Cannot create modifier!");
        }
    };
    const handleCreateViewer = async () => {
        if (!newViewerName.trim())
            return;
        try {
            const created = await createViewer({ name: newViewerName.trim() });
            if (!created)
                return;
            const normalizedCreated = normalizeViewerBlueprint(created as ViewerBlueprint);
            setAvailableViewers((current) => [...current, normalizedCreated]);
            insertViewerLine({ viewer: normalizedCreated });
            setNewViewerName("");
            setIsCreateViewerOpen(false);
        }
        catch (error) {
            displayError(error, "[Error] Cannot create viewer!");
        }
    };
    return (<>
      <Modal isOpen={isAddModifierOpen} onClose={() => setIsAddModifierOpen(false)}>
        <ModalContent>
          <ModalHeader>Add Modifier</ModalHeader>
          <ModalBody className="gap-4">
            {groupedModifiers.length === 0 ? (<p className="text-default-500 text-sm py-4 text-center">
                No modifiers available.
              </p>) : (<Select aria-label="Select Modifier" className="w-full" classNames={{
                trigger: "px-4 h-14",
                value: "py-2 text-left",
                listboxWrapper: "w-full",
                popoverContent: "w-full",
            }} placeholder="Select a modifier" selectedKeys={selectedModifierId
                ? new Set([selectedModifierId])
                : new Set([])} selectionMode="single" variant="bordered" renderValue={() => {
                const modifier = availableModifiers.find((m) => m._id === selectedModifierId);
                if (!modifier)
                    return "Select a modifier";
                return (<div className="flex flex-col items-start gap-1 py-1">
                      <span className="font-medium flex gap-2">
                        {modifier.name}
                        {getModifierDisplayName(modifier) !== modifier.name && (<>
                            <span className="text-default-500">&bull;</span>
                            <span className="text-default-500">
                              {getModifierDisplayName(modifier)}
                            </span>
                          </>)}
                      </span>
                      <span className="text-xs text-default-500">
                        {modifier.scope === "line" ? "Line" : "Total"} •{" "}
                        {modifier.operation === "add" ? "+" : "-"}
                        {modifier.value}
                        {modifier.type === "percentage" ? "%" : ""}{" "}
                      </span>
                    </div>);
            }} onSelectionChange={(keys) => {
                if (keys === "all")
                    return;
                const nextId = String(Array.from(keys)[0] || "");
                const nextModifierGroup = groupedModifiers.find((group) => group.modifiers.some((modifier) => modifier._id === nextId));
                const nextModifier = nextModifierGroup?.modifiers.find((modifier) => modifier._id === nextId);
                setSelectedModifierId(nextId);
                setModifierForm((current) => ({
                    ...current,
                    currency: nextModifierGroup?.hasMultipleCurrencies
                        ? nextModifier?.currency ||
                            nextModifierGroup.currencies[0]
                        : undefined,
                    targetProductLine: [],
                }));
            }}>
                {groupedModifiers.map((group) => {
                console.log({ group });
                return group.hasMultipleCurrencies ? (
                // Group with multiple currencies
                <SelectItem key={group.modifiers[0]._id} textValue={group.modifiers[0].name}>
                      <div className="flex flex-col gap-0.5 py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {getModifierDisplayName(group.modifiers[0])}
                          </span>
                          <span className="rounded bg-default-100 px-1.5 py-0.5 text-xs text-default-500">
                            {group.modifiers[0].scope === "line"
                        ? "Line"
                        : "Total"}
                          </span>
                          <span className="rounded bg-default-100 px-1.5 py-0.5 text-xs text-default-500">
                            {group.modifiers[0].operation === "add" ? "+" : "-"}
                            {group.modifiers[0].value}
                          </span>
                          <span className="rounded bg-warning-100 px-1.5 py-0.5 text-xs text-warning-700">
                            {group.currencies.length} currencies
                          </span>
                        </div>
                      </div>
                    </SelectItem>) : (
                // Regular modifier
                <SelectItem key={group.modifiers[0]._id} textValue={group.modifiers[0].name}>
                      <div className="flex flex-row w-full gap-2 py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {group.modifiers[0].name}
                          </span>
                          <span className="rounded bg-default-100 px-1.5 py-0.5 text-xs text-default-500">
                            {group.modifiers[0].scope === "line"
                        ? "Line"
                        : "Total"}
                          </span>
                          <span className="rounded bg-default-100 px-1.5 py-0.5 text-xs text-default-500">
                            {group.modifiers[0].operation === "add" ? "+" : "-"}
                            {group.modifiers[0].value}
                            {group.modifiers[0].type === "percentage"
                        ? "%"
                        : ""}
                          </span>
                          {group.modifiers[0].currency && (<span className="rounded bg-default-100 px-1.5 py-0.5 text-xs text-default-500">
                              {group.modifiers[0].currency}
                            </span>)}
                        </div>
                      </div>
                    </SelectItem>);
            })}
              </Select>)}

            {selectedModifier?.scope === "line" && selectedModifierId && (<div className="rounded-xl border border-default-200 p-3">
                <p className="mb-2 text-sm font-medium">
                  Apply to product rows
                </p>
                <div className="flex flex-col gap-2">
                  {validProductRows.map((line) => (<Checkbox key={line._id} isSelected={modifierForm.targetProductLine.includes(line._id)} onValueChange={(checked) => setModifierForm((current) => ({
                    ...current,
                    targetProductLine: checked
                        ? [...current.targetProductLine, line._id]
                        : current.targetProductLine.filter((id) => id !== line._id),
                }))}>
                      {line.product?.name}
                    </Checkbox>))}
                </div>
              </div>)}

            {selectedModifierGroup?.hasMultipleCurrencies &&
            selectedModifierId && (<div className="rounded-xl p-3">
                  <p className="mb-2 text-sm font-medium">Select Currency</p>
                  <Select renderValue={() => (<>
                        {modifierForm.currency} (
                        {displayCurrency(modifierForm.currency!)})
                      </>)} selectedKeys={modifierForm.currency
                ? new Set([modifierForm.currency])
                : new Set([])} onSelectionChange={(keys) => setModifierForm((current) => ({
                ...current,
                currency: String(Array.from(keys)[0]) as Currency,
            }))}>
                    {selectedModifierGroup.currencies.map((currency) => (<SelectItem key={currency}>
                        {currency} ({displayCurrency(currency)})
                      </SelectItem>))}
                  </Select>
                </div>)}
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" isDisabled={!selectedModifierId} onPress={addExistingModifier}>
              Add Modifier
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isCreateModifierOpen} onClose={() => setIsCreateModifierOpen(false)}>
        <ModalContent>
          <ModalHeader>Create Modifier</ModalHeader>
          <ModalBody className="gap-4">
            <Input label="Name" value={modifierForm.name} onChange={(event) => setModifierForm((current) => ({
            ...current,
            name: event.target.value,
        }))}/>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Scope" selectedKeys={new Set([modifierForm.scope])} onSelectionChange={(keys) => setModifierForm((current) => ({
            ...current,
            scope: String(Array.from(keys)[0] || "total") as "line" | "total",
            targetProductLine: [],
        }))}>
                <SelectItem key="total">Total</SelectItem>
                <SelectItem key="line">Line</SelectItem>
              </Select>
              <Select label="Type" selectedKeys={new Set([modifierForm.type])} onSelectionChange={(keys) => setModifierForm((current) => ({
            ...current,
            type: String(Array.from(keys)[0] || "percentage") as "percentage" | "fixed",
        }))}>
                <SelectItem key="percentage">Percentage</SelectItem>
                <SelectItem key="fixed">Fixed</SelectItem>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Operation" selectedKeys={new Set([modifierForm.operation])} onSelectionChange={(keys) => setModifierForm((current) => ({
            ...current,
            operation: String(Array.from(keys)[0] || "add") as "add" | "subtract",
        }))}>
                <SelectItem key="add">Add</SelectItem>
                <SelectItem key="subtract">Subtract</SelectItem>
              </Select>
              <Input label="Value" type="number" value={String(modifierForm.value)} onChange={(event) => setModifierForm((current) => ({
            ...current,
            value: Number(event.target.value || 0),
        }))}/>
            </div>

            {modifierForm.type === "fixed" ? (<Select label="Currency" selectedKeys={modifierForm.currency
                ? new Set([modifierForm.currency])
                : new Set([])} onSelectionChange={(keys) => setModifierForm((current) => ({
                ...current,
                currency: String(Array.from(keys)[0]) as Currency,
            }))}>
                <SelectItem key="EUR">EUR (€)</SelectItem>
                <SelectItem key="USD">USD ($)</SelectItem>
                <SelectItem key="RON">RON (Lei)</SelectItem>
                <SelectItem key="GBP">GBP (£)</SelectItem>
              </Select>) : null}

            {modifierForm.scope === "line" ? (<div className="rounded-xl border border-default-200 p-3">
                <p className="mb-2 text-sm font-medium">
                  Apply to product rows
                </p>
                <div className="flex flex-col gap-2">
                  {validProductRows.map((line) => (<Checkbox key={line._id} isSelected={modifierForm.targetProductLine.includes(line._id)} onValueChange={(checked) => setModifierForm((current) => ({
                    ...current,
                    targetProductLine: checked
                        ? [...current.targetProductLine, line._id]
                        : current.targetProductLine.filter((id) => id !== line._id),
                }))}>
                      {line.product?.name}
                    </Checkbox>))}
                </div>
              </div>) : null}
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onPress={handleCreateModifier}>
              Create Modifier
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isAddViewerOpen} onClose={() => setIsAddViewerOpen(false)}>
        <ModalContent>
          <ModalHeader>Add Viewer</ModalHeader>
          <ModalBody>
            <Select label="Viewer" selectedKeys={selectedViewerId ? new Set([selectedViewerId]) : new Set([])} onSelectionChange={(keys) => setSelectedViewerId(String(Array.from(keys)[0] || ""))}>
              {availableViewers.map((viewer) => (<SelectItem key={viewer._id}>
                  {getViewerDisplayName(viewer)}
                </SelectItem>))}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onPress={addExistingViewer}>
              Add Viewer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isCreateViewerOpen} onClose={() => setIsCreateViewerOpen(false)}>
        <ModalContent>
          <ModalHeader>Create Viewer</ModalHeader>
          <ModalBody>
            <Input label="Name" value={newViewerName} onChange={(event) => setNewViewerName(event.target.value)}/>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onPress={handleCreateViewer}>
              Create Viewer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <div className={`mt-4 ${viewMode === "read" ? "opacity-80 saturate-50" : ""}`}>
        <div className="mb-3 flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-default-500">
            Products Total: {netTotal.toFixed(2)}
            {displayCurrency(netCurrency)}
          </span>
          <div className="flex">
            <Tooltip content="Add at least one product before adding modifiers" isDisabled={canManageModifiers || viewMode === "read"} color="warning">
              <Button size="sm" color="secondary" variant="flat" className="rounded-r-none" isDisabled={!canManageModifiers} startContent={<DiscountOutlined className="text-medium!"/>} onPress={() => {
            if (!canManageModifiers)
                return;
            setIsAddModifierOpen(true);
        }}>
                Add Modifiers
              </Button>
            </Tooltip>
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Button isIconOnly size="sm" color="secondary" variant="flat" className="rounded-l-none border-l border-secondary-200" isDisabled={!canManageModifiers}>
                  <KeyboardArrowDownRoundedIcon fontSize="small"/>
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Modifier actions">
                <DropdownSection showDivider>
                  <DropdownItem key="add-viewer" onPress={() => setIsAddViewerOpen(true)} startContent={<FunctionsRoundedIcon className="text-lg!"/>}>
                    Add Viewer
                  </DropdownItem>
                </DropdownSection>
                <DropdownSection>
                  <DropdownItem key="create-modifier" isDisabled={!canManageModifiers} onPress={() => setIsCreateModifierOpen(true)} startContent={<AddCircleOutlineRoundedIcon className="text-lg!"/>}>
                    Create Modifier
                  </DropdownItem>
                  <DropdownItem key="create-viewer" onPress={() => setIsCreateViewerOpen(true)} startContent={<AddCircleOutlineRoundedIcon className="text-lg!"/>}>
                    Create Viewer
                  </DropdownItem>
                </DropdownSection>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>

        <div className="grid grid-cols-[32px_minmax(0,1.2fr)_minmax(0,1fr)_120px_88px] gap-3 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-default-500">
          <span />
          <span>Name</span>
          <span>Details</span>
          <span>Type</span>
          <span />
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map((row) => row._id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {rows.map((row) => (<SortableRow key={row._id} row={row} viewMode={viewMode} onRemove={removeRow} selectedLanguageCode={selectedLanguageCode} selectedLanguageName={selectedLanguageName} onStartTranslationEdit={handleStartTranslationEdit} onTranslationDraftChange={handleTranslationDraftChange} onCancelTranslationEdit={handleCancelTranslationEdit} onSaveTranslation={handleSaveTranslation} displayName={row.kind === "modifier"
                ? getModifierDisplayName(row.modifier)
                : getViewerDisplayName(row.viewer)} isMissingTranslation={row.kind === "modifier"
                ? Boolean(modifierDisplayById[row.modifier._id]
                    ?.isMissingTranslation)
                : Boolean(viewerDisplayById[row.viewer._id]
                    ?.isMissingTranslation)}/>))}
              {rows.length === 0 ? (<div className="rounded-xl border border-dashed border-default-300 px-4 py-6 text-center text-sm text-default-400">
                  No modifiers or viewers added yet.
                </div>) : null}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </>);
}
