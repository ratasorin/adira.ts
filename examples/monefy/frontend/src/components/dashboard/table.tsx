import { ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState, } from "react";
import { displayError } from "../../utils/handle-error";
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, InputProps, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tooltip, Textarea, TextAreaProps, } from "@heroui/react";
import z from "zod";
import ArrowDropDownRoundedIcon from "@mui/icons-material/ArrowDropDownRounded";
import { ButtonSwitch } from "../button-switch";
import { DeleteIcon, EditIcon } from "../icons";
import DoneRoundedIcon from "@mui/icons-material/DoneRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Leafs } from "@n/adira.core.ts";
import { nanoid } from "nanoid";
import { Leafs as _Leafs } from "@n/adira.core.ts";
type ImageRenderParams = {
    inputType: "IMAGE";
    alt?: string;
    width?: number | string;
    height?: number | string;
    className?: string;
};
const isImageRenderParams = <Obj, R extends Leafs<Obj>>(params: RenderParams<Obj, R>): params is ImageRenderParams => {
    return params.inputType === "IMAGE";
};
type TextareaRenderParams = {
    inputType: "TEXTAREA";
    validators: z.ZodType[];
} & TextAreaProps;
const isTextareaRenderParams = <U, R extends _Leafs<U>>(params: RenderParams<U, R>): params is TextareaRenderParams => {
    return params.inputType === "TEXTAREA";
};
type TextRenderParams = {
    inputType: "TEXT";
    validators: z.ZodType[];
} & InputProps;
type CheckboxRenderParams = {
    inputType: "CHECKBOX";
    checkedText: string;
    uncheckedText: string;
};
type DropdownRenderParams<Obj, R extends Leafs<Obj> = Leafs<Obj>, Item = ExtractValue<Obj, R>> = {
    inputType: "DROPDOWN";
    options: (item: Obj) => Item[];
    renderer: (option: Item) => ReactNode;
    key: (option: Item) => string;
};
type RenderParams<Obj, R extends Leafs<Obj>> = TextRenderParams | CheckboxRenderParams | DropdownRenderParams<Obj, R> | ImageRenderParams | TextareaRenderParams;
const isTextRenderParams = <U, R extends _Leafs<U>>(params: RenderParams<U, R>): params is TextRenderParams => {
    return params.inputType === "TEXT";
};
const isCheckboxRenderParams = <U, R extends _Leafs<U>>(params: RenderParams<U, R>): params is CheckboxRenderParams => {
    return params.inputType === "CHECKBOX";
};
const isDropdownRenderParams = <U, R extends _Leafs<U>>(params: RenderParams<U, R>): params is DropdownRenderParams<U, R> => {
    return params.inputType === "DROPDOWN";
};
type ExtractValue<T, K extends string> = K extends `${infer Key}.${infer Rest}` ? Key extends keyof T ? T[Key] extends (infer U)[] ? ExtractValue<U, Rest>[] : ExtractValue<T[Key], Rest> : never : K extends keyof T ? T[K] : never;
export type RowMetadata<U> = U & {
    rowId: string;
    editMode?: boolean;
    createMode?: boolean;
    errors?: Partial<Record<_Leafs<U>, string[]>>;
};
export const withRowMetadata = <T,>(t: T): RowMetadata<T> => {
    return {
        ...t,
        createMode: false,
        editMode: false,
        errors: {},
        rowId: nanoid(),
    };
};
const checkErrors = (validators: z.ZodType[], value: string | number | boolean) => {
    return validators.reduce((errors, validator) => {
        const result = validator.safeParse(value);
        if (!result.success) {
            return [...errors, ...z.treeifyError(result.error).errors];
        }
        return errors;
    }, [] as string[]);
};
export const useDashboardTable = <U,>({ get, table, }: {
    get: () => Promise<RowMetadata<U>[] | undefined>;
    table: {
        elements: string;
        id: string;
    };
}) => {
    const [items, setItems] = useState<RowMetadata<U>[]>([]);
    const itemSnapshot = useRef<RowMetadata<U> | undefined>(undefined);
    const [itemToDelete, setItemToDelete] = useState<RowMetadata<U> | undefined>();
    const [isEditing, setIsEditing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    // Mutation pipeline
    const updateQueue = useRef<((items: RowMetadata<U>[]) => RowMetadata<U>[])[]>([]);
    const debounceTimer = useRef<number | null>(null);
    const processQueue = () => {
        setItems((prev) => {
            let next = prev;
            for (const fn of updateQueue.current) {
                next = fn(next);
            }
            updateQueue.current = [];
            return next;
        });
    };
    const scheduleFlush = useCallback(() => {
        if (debounceTimer.current !== null) {
            clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = window.setTimeout(() => {
            processQueue();
        }, 10);
    }, []);
    const handleItemUpdate = useCallback((fn: (items: RowMetadata<U>[]) => RowMetadata<U>[]) => {
        updateQueue.current.push(fn);
        scheduleFlush();
    }, [scheduleFlush]);
    const createItemSnapshot = useCallback((element: RowMetadata<U>) => {
        setIsEditing(true);
        itemSnapshot.current = element;
    }, []);
    const abortItemCreation = useCallback(() => {
        handleItemUpdate((items) => {
            setIsCreating(false);
            return items.filter((item) => item.createMode !== true);
        });
    }, [handleItemUpdate]);
    const replaceItem = useCallback((newItem: RowMetadata<U>, pred: (u: RowMetadata<U>) => boolean) => {
        handleItemUpdate((items) => items.map((u) => (pred(u) ? newItem : u)));
    }, [handleItemUpdate]);
    const resetSnapshot = useCallback(() => {
        itemSnapshot.current = undefined;
    }, []);
    const resetEditedItemState = useCallback(() => {
        if (itemSnapshot.current !== undefined) {
            handleItemUpdate((items) => {
                const newItems = items.map((item) => item.rowId === itemSnapshot.current?.rowId
                    ? itemSnapshot.current!
                    : item);
                resetSnapshot();
                setIsEditing(false);
                return newItems;
            });
        }
    }, [handleItemUpdate, resetSnapshot]);
    const resetTableState = useCallback(() => {
        if (isEditing || isCreating) {
            abortItemCreation();
            resetEditedItemState();
        }
    }, [isEditing, isCreating, abortItemCreation, resetEditedItemState]);
    const addNewItem = useCallback((item: RowMetadata<U>) => {
        abortItemCreation();
        document.getElementById(table.id)?.focus();
        handleItemUpdate((items) => {
            setIsCreating(true);
            return [item, ...items];
        });
    }, [abortItemCreation, handleItemUpdate, table.id]);
    const removeItem = useCallback(() => {
        handleItemUpdate((items) => items.filter((item) => item.rowId !== itemToDelete?.rowId));
        setItemToDelete(undefined);
    }, [handleItemUpdate, itemToDelete?.rowId]);
    useEffect(() => {
        get().then((rows) => {
            setItems(rows || []);
        });
    }, []);
    return {
        items,
        handleItemUpdate,
        resetEditedItemState,
        resetTableState,
        createItemSnapshot,
        abortItemCreation,
        replaceItem,
        addNewItem,
        removeItem,
        itemToDelete,
        resetSnapshot,
        elements: table.elements,
        isEditing,
        tableId: table.id,
        isCreating,
        itemSnapshot: itemSnapshot.current,
        setItemToDelete,
    };
};
function extractValue<U, K extends _Leafs<U>>(obj: U, path: K): ExtractValue<U, K> {
    const pathString: string = String(path);
    const parts = pathString.split(".");
    // We use 'any' internally because recursive path reduction
    // is too complex for TS to track via .reduce()
    return parts.reduce((acc: unknown, key: string) => {
        if (acc === null || acc === undefined)
            return acc;
        // If the current accumulator is an array, map the key over its children
        if (Array.isArray(acc)) {
            return acc.map((item) => item && typeof item === "object" ? item[key] : undefined);
        }
        // @ts-expect-error: We ensure type safety at the function level, so this is fine
        return acc[key];
    }, obj) as ExtractValue<U, K>;
}
function setNestedValue<O extends Record<string, unknown>, U extends string>(obj: O, path: U, value: unknown): O {
    const keys = path.split(".");
    // Recursive helper to build updated object immutably
    const recursiveSet = <T extends Record<string, unknown>>(o: T | undefined, [key, ...rest]: string[]): Record<string, unknown> => {
        if (!o)
            return {};
        if (!key)
            return o;
        return {
            ...o,
            [key]: rest.length
                ? recursiveSet(o?.[key] as Record<string, unknown>, rest)
                : value,
        };
    };
    return recursiveSet(obj, keys) as O;
}
export interface DataColumn<U, K extends _Leafs<U>> {
    name: string;
    isEditable?: boolean;
    render: (el: ExtractValue<U, K>) => ReactNode;
    renderParams: RenderParams<U, K>;
}
interface DashboardTableProps<U> {
    columnSet: {
        [K in _Leafs<U> & string]?: DataColumn<U, K>;
    };
    unitName?: string;
    itemToDelete: RowMetadata<U> | undefined;
    setItemToDelete: React.Dispatch<React.SetStateAction<RowMetadata<U> | undefined>>;
    forbidDelete: (el: RowMetadata<U>) => boolean;
    resetTableState: () => void;
    handleItemUpdate: (fn: (items: RowMetadata<U>[]) => RowMetadata<U>[]) => void;
    createItemSnapshot: (element: RowMetadata<U>) => void;
    abortItemCreation: () => void;
    resetSnapshot: () => void;
    items: RowMetadata<U>[];
    onUpdate: (element: RowMetadata<U>) => Promise<boolean>;
    onDelete: (element: RowMetadata<U>) => Promise<boolean>;
    onCreate: (element: RowMetadata<U>) => Promise<boolean>;
    resetEditedItemState: () => void;
    tableId: string;
}
const DashboardTable = <U,>({ forbidDelete, columnSet, resetEditedItemState, resetTableState, onCreate, handleItemUpdate, unitName, createItemSnapshot, abortItemCreation, items, setItemToDelete, resetSnapshot, onDelete, onUpdate, tableId, }: DashboardTableProps<U>) => {
    const renderCell = useCallback((element: RowMetadata<U>, columnId: _Leafs<U>) => {
        const createMode = element.createMode || false;
        const editMode = element.editMode || false;
        const readMode = !editMode && !createMode;
        const replacementCondition = (u: RowMetadata<U>) => u.rowId === element.rowId;
        if (columnId === "actions")
            return (<div className="relative flex items-center gap-2">
            {readMode ? (<>
                <Tooltip closeDelay={0} content={`Edit ${unitName}`}>
                  <Button isIconOnly onPress={() => {
                        document.getElementById(tableId)?.focus();
                        // reset the previous item to it's original settings
                        // or remove any items getting created
                        resetTableState();
                        handleItemUpdate((items) => {
                            // save the current item's settings and allow edits
                            createItemSnapshot(element);
                            return items.map((item) => replacementCondition(item)
                                ? { ...item, editMode: true }
                                : item);
                        });
                    }} variant="light" className="text-xl text-default-400 min-w-7 h-7 w-7 active:opacity-50">
                    <EditIcon />
                  </Button>
                </Tooltip>
                {!forbidDelete(element) ? (<Tooltip closeDelay={0} color="danger" content={`Delete ${unitName}`}>
                    <Button isIconOnly variant="light" color="danger" onPress={async () => {
                            const confirmed = await onDelete(element);
                            if (confirmed) {
                                resetSnapshot();
                                setItemToDelete(element);
                            }
                        }} className="text-xl min-w-7 h-7 w-7 active:opacity-50">
                      <DeleteIcon />
                    </Button>
                  </Tooltip>) : null}
              </>) : null}
            {editMode ? (<>
                <Tooltip closeDelay={0} content="Save changes">
                  <Button isDisabled={Object.values(element.errors || {}).flatMap((arr) => arr)
                        .length > 0} isIconOnly color="success" onPress={async () => {
                        const confirmed = await onUpdate(element);
                        if (confirmed) {
                            resetSnapshot();
                            handleItemUpdate((items) => items.map((item) => replacementCondition(item)
                                ? { ...item, editMode: false }
                                : item));
                        }
                        else {
                            resetEditedItemState();
                        }
                    }} variant="light" className="min-w-7 h-7 w-7 active:opacity-50">
                    <DoneRoundedIcon fontSize="medium"/>
                  </Button>
                </Tooltip>
                <Tooltip closeDelay={0} content="Cancel edit">
                  <Button isIconOnly variant="light" color="danger" onPress={() => {
                        resetEditedItemState();
                    }} className="min-w-7 h-7 w-7 active:opacity-50">
                    <CloseRoundedIcon fontSize="medium"/>
                  </Button>
                </Tooltip>
              </>) : null}

            {createMode ? (<>
                <Tooltip closeDelay={0} content={`Save ${unitName ?? "item"}`}>
                  <Button isIconOnly color="success" isDisabled={Object.values(element.errors || {}).flatMap((arr) => arr)
                        .length > 0} onPress={async () => {
                        const confirmed = await onCreate(element);
                        if (confirmed) {
                            resetSnapshot();
                            handleItemUpdate((items) => items.map((item) => replacementCondition(item)
                                ? { ...item, createMode: false }
                                : item));
                        }
                    }} variant="light" className="min-w-7 h-7 w-7 active:opacity-50">
                    <DoneRoundedIcon fontSize="medium"/>
                  </Button>
                </Tooltip>
                <Tooltip closeDelay={0} content="Cancel edit">
                  <Button isIconOnly variant="light" color="danger" onPress={() => {
                        abortItemCreation();
                    }} className="text-xl min-w-7 h-7 w-7 active:opacity-50">
                    <CloseRoundedIcon />
                  </Button>
                </Tooltip>
              </>) : null}
          </div>);
        for (const [colId, col] of Object.entries<DataColumn<U, _Leafs<U>>>(
        // @ts-expect-error: Cannot prove columnSet respects the DataColumn interface
        columnSet)) {
            if (colId === columnId) {
                if (isTextareaRenderParams(col.renderParams)) {
                    if (readMode || (editMode && !col.isEditable))
                        return col.render(extractValue(element as U, columnId));
                    if (editMode || createMode) {
                        return (<Tooltip content={element?.errors?.[columnId]?.map((err: string) => (<p>{err}</p>))} isDisabled={(element?.errors?.[columnId]?.length || 0) === 0} color="danger" offset={16} showArrow closeDelay={0}>
                  <Textarea {...col.renderParams} key={element.rowId} defaultValue={String(extractValue(element as U, columnId))} className="min-w-40" isInvalid={(element?.errors?.[columnId]?.length || 0) > 0} onValueChange={(newValue) => {
                                const errors = checkErrors((col.renderParams as TextareaRenderParams).validators, newValue);
                                handleItemUpdate((items) => {
                                    return items.map((item) => {
                                        return item.rowId === element.rowId
                                            ? {
                                                ...setNestedValue(item, columnId, newValue),
                                                errors: {
                                                    ...(item.errors || {}),
                                                    [columnId]: errors,
                                                },
                                            }
                                            : item;
                                    });
                                });
                            }}/>
                </Tooltip>);
                    }
                }
                if (isImageRenderParams(col.renderParams)) {
                    if (readMode || (editMode && !col.isEditable)) {
                        return col.render(extractValue(element as U, columnId));
                    }
                    if (editMode || createMode) {
                        return (<input type="file" accept="image/*" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file)
                                    return;
                                const formData = new FormData();
                                formData.append("file", file);
                                try {
                                    const res = await fetch(`/api/upload`, {
                                        method: "POST",
                                        body: formData,
                                    });
                                    if (!res.ok)
                                        throw new Error("Upload failed");
                                    const data = await res.json();
                                    // Assume backend returns { url: string } or { id: string }
                                    const returnedString = data.url || data.id;
                                    handleItemUpdate((items) => items.map((item) => item.rowId === element.rowId
                                        ? setNestedValue(item, columnId, returnedString)
                                        : item));
                                }
                                catch (err) {
                                    displayError(err, "Image upload failed");
                                }
                            }}/>);
                    }
                }
                if (isTextRenderParams(col.renderParams)) {
                    if (readMode || (editMode && !col.isEditable))
                        return col.render(extractValue(element as U, columnId));
                    if (editMode || createMode) {
                        return (<Tooltip content={element?.errors?.[columnId]?.map((err: string) => (<p>{err}</p>))} isDisabled={(element?.errors?.[columnId]?.length || 0) === 0} color="danger" offset={16} showArrow closeDelay={0}>
                  <Input {...col.renderParams} key={element.rowId} defaultValue={String(extractValue(element as U, columnId))} className="min-w-40" isInvalid={(element?.errors?.[columnId]?.length || 0) > 0} onValueChange={(newValue) => {
                                const errors = checkErrors((col.renderParams as TextRenderParams).validators, newValue);
                                handleItemUpdate((items) => {
                                    return items.map((item) => {
                                        return item.rowId === element.rowId
                                            ? {
                                                ...setNestedValue(item, columnId, newValue),
                                                errors: {
                                                    ...(item.errors || {}),
                                                    [columnId]: errors,
                                                },
                                            }
                                            : item;
                                    });
                                });
                            }}/>
                </Tooltip>);
                    }
                }
                if (isDropdownRenderParams(col.renderParams)) {
                    if (readMode || (editMode && !col.isEditable))
                        return col.render(extractValue(element as U, columnId));
                    if (editMode || createMode) {
                        if (createMode) {
                            if (!extractValue(element as U, columnId))
                                handleItemUpdate((items) => items.map((item) => item.rowId === element.rowId
                                    ? {
                                        ...item,
                                        errors: {
                                            ...(item.errors || {}),
                                            [columnId]: ["Missing value!"],
                                        },
                                    }
                                    : item));
                            else
                                handleItemUpdate((items) => items.map((item) => item.rowId === element.rowId
                                    ? {
                                        ...item,
                                        errors: { ...(item.errors || {}), [columnId]: [] },
                                    }
                                    : item));
                        }
                        return (<Dropdown>
                  <DropdownTrigger>
                    <Button className="relative" endContent={<ArrowDropDownRoundedIcon className="relative z-20"/>}>
                      <Tooltip content={element?.errors?.[columnId]?.map((err: string) => (<p>{err}</p>))} isDisabled={(element?.errors?.[columnId]?.length || 0) === 0} color="danger" offset={8} showArrow closeDelay={0}>
                        <div aria-hidden="true" role="presentation" className={`absolute w-full h-full ${(element?.errors?.[columnId]?.length || 0) === 0
                                ? "bg-transparent"
                                : "bg-danger-50"}`}></div>
                      </Tooltip>
                      {col.render(extractValue(element as U, columnId))}
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu>
                    {col.renderParams.options(element).map((option) => (<DropdownItem onPress={() => {
                                    handleItemUpdate((items) => {
                                        return items.map((item) => {
                                            return item.rowId === element.rowId
                                                ? setNestedValue(item, columnId, option)
                                                : item;
                                        });
                                    });
                                }} key={(col.renderParams as DropdownRenderParams<U, typeof columnId>).key(option)}>
                        {(col.renderParams as DropdownRenderParams<U, typeof columnId>).renderer(option)}
                      </DropdownItem>))}
                  </DropdownMenu>
                </Dropdown>);
                    }
                }
                if (isCheckboxRenderParams(col.renderParams)) {
                    if (readMode || (editMode && !col.isEditable))
                        return col.render(extractValue(element as U, columnId));
                    if (editMode || createMode) {
                        return (<ButtonSwitch checked={!!extractValue(element as U, columnId) || false} checkedTitle="Verified" uncheckedTitle="Unverified" onCheck={(selected) => {
                                handleItemUpdate((items) => {
                                    return items.map((item) => {
                                        return item.rowId === element.rowId
                                            ? setNestedValue(item, columnId, selected)
                                            : item;
                                    });
                                });
                            }}/>);
                    }
                }
            }
        }
    }, [
        abortItemCreation,
        columnSet,
        createItemSnapshot,
        forbidDelete,
        handleItemUpdate,
        onDelete,
        onUpdate,
        resetSnapshot,
        resetEditedItemState,
        setItemToDelete,
        resetTableState,
        tableId,
        onCreate,
        unitName,
    ]);
    const extendedColumns: {
        name: string | null;
        key: string;
    }[] = useMemo(() => [
        { name: "actions", key: "actions" },
        ...Object.entries(columnSet).map(([key, value]) => ({
            name: value && typeof value === "object" && "name" in value
                ? (value["name"] as string)
                : null,
            key: key,
        })),
    ], [columnSet]);
    return (<Suspense fallback={<Spinner></Spinner>}>
      {items.length > 0 ? (<Table classNames={{ wrapper: "overflow-x-auto", table: "min-w-max", th: "whitespace-nowrap px-3", td: "px-3" }} tabIndex={-1} id={tableId} onKeyDown={(e) => {
                if (e.key === "Escape") {
                    resetTableState();
                }
            }} isKeyboardNavigationDisabled>
          <TableHeader columns={extendedColumns}>
            {(column) => (<TableColumn key={String(column.key)}>{column.name}</TableColumn>)}
          </TableHeader>
          <TableBody items={items.map(item => ({ ...item }))}>
            {(item) => {
                return (<TableRow key={item.rowId}>
                  {(columnId) => {
                        return (<TableCell>
                        {renderCell(item, columnId as _Leafs<U>)}
                      </TableCell>);
                    }}
                </TableRow>);
            }}
          </TableBody>
        </Table>) : null}
    </Suspense>);
};
export default DashboardTable;
