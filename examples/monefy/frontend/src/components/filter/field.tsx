import { FC, useCallback, useRef } from "react";
import { FlatField } from "./types";
import { useUrlQueryParams } from "../../hooks/use-url-query-params";
import { Select, SelectItem } from "@heroui/select";
import { Tabs, Tab } from "@heroui/tabs";
import { Slider } from "@heroui/slider";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
interface FieldProps {
    field: FlatField;
    parentPortal: HTMLDivElement;
}
const SectionTitle: FC<{
    title: string;
    icon: React.ReactNode;
}> = ({ title, icon, }) => {
    return (<span className="flex items-center gap-2 text-foreground-400">
      {title.toLocaleUpperCase()}
      {icon}
    </span>);
};
const Field: FC<FieldProps> = ({ field, parentPortal }) => {
    const [selectedValues, setSelectedValues] = useUrlQueryParams({
        queryParamKey: String(field.key),
        fallback: "",
        mode: "BOTH",
    });
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debouncedOnChange = useCallback((v: number | number[] | undefined) => {
        if (Array.isArray(v)) {
            setSelectedValues(v.join(";"), true);
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            if (Array.isArray(v)) {
                setSelectedValues(v.join(";"));
            }
        }, 300);
    }, [setSelectedValues]);
    const DefaultSectionTitle = useCallback(() => {
        return (<SectionTitle icon={field.icon} title={field.renderKey
                ? field.renderKey(String(field.key))
                : String(field.key)}/>);
    }, [field]);
    if (field.mode === "MULTIPLE") {
        return (<div key={String(field.key)} className="flex flex-col gap-2 w-full">
        <DefaultSectionTitle />
        <Select selectedKeys={selectedValues[String(field.key)]
                ? new Set(selectedValues[String(field.key)]?.split(";") || [])
                : new Set([])} multiple className="w-full max-w-72" placeholder={`Select a ${String(field.key)}`} size="sm" aria-label={String(field.key)} popoverProps={{
                // Fix:
                //  Option needed to prevent the dropdown select from closing when scrolling very fast
                // Issue Description:
                //  To improve render time @heroui virtualizes the list, so only about 10 items get mounted at a time.
                //  The first element receives "focus" inside the popover. When scrolling fast, that element is unmounted
                //  before a new element can be focused, and @heroui restores focus in the button that triggered the dropdown.
                //  Because the button is outside the `<Overlay></Overlay>` component of @react-aria (which is what @heroui uses)
                //  and not rendered inside of `body` (it is set to render inside the `parentPortal`) the `Overlay` component
                //  decides to call the `onBlurWithin` (more about that here: https://github.com/adobe/react-spectrum/blob/main/packages/%40react-aria/overlays/src/useOverlay.ts)
                //  that will call the onClose(). Setting `shouldCloseOnBlur` deactivates the `onBlurWithin` function.
                shouldCloseOnBlur: false,
                portalContainer: parentPortal,
            }} onSelectionChange={(selection) => {
                if (selection.currentKey) {
                    setSelectedValues(`${selectedValues[String(field.key)]};${selection.currentKey}`);
                }
                else {
                    const selectedItems = [
                        ...(selection as Set<string | number>).keys(),
                    ].join(";");
                    setSelectedValues(selectedItems);
                }
            }}>
          {field.values.map((v) => (<SelectItem key={String(v)}>{String(v)}</SelectItem>))}
        </Select>
      </div>);
    }
    if (field.mode === "BINARY") {
        return (<div key={String(field.key)} className="flex flex-col gap-2 w-full">
        <DefaultSectionTitle />
        <Tabs selectedKey={selectedValues[String(field.key)]} onSelectionChange={(k) => setSelectedValues(String(k))} variant="solid" classNames={{ tabList: "w-full" }} aria-label={String(field.key)}>
          {field.values.map((v) => (<Tab key={String(v)} title={String(v)}></Tab>))}
        </Tabs>
      </div>);
    }
    if (field.mode === "SEARCH") {
        return (<div key={String(field.key)} className="flex flex-col gap-2 w-full">
        <DefaultSectionTitle />
        <Autocomplete selectedKey={selectedValues[String(field.key)]
                ? selectedValues[String(field.key)]
                : null} popoverProps={{
                shouldCloseOnBlur: false,
                portalContainer: parentPortal,
            }} onSelectionChange={(selection) => {
                setSelectedValues(String(selection));
            }} className="max-w-xs" placeholder={`Search ${String(field.key)}`}>
          {field.values.map((v) => (<AutocompleteItem key={String(v)}>{String(v)}</AutocompleteItem>))}
        </Autocomplete>
      </div>);
    }
    if (field.mode === "RANGE") {
        // Ensure field.values exists and has elements before sorting
        const sortedValues = field.values && field.values.length > 0
            ? [...field.values].sort((a, b) => {
                // Handle potentially undefined values
                if (a === undefined && b === undefined)
                    return 0;
                if (a === undefined)
                    return 1;
                if (b === undefined)
                    return -1;
                return a > b ? 1 : a < b ? -1 : 0;
            })
            : [];
        const minValue = sortedValues.length > 0 ? String(sortedValues[0]) : "";
        const maxValue = sortedValues.length > 0
            ? String(sortedValues[sortedValues.length - 1])
            : "";
        return (<div className="flex flex-col gap-3 w-full">
        <span className="flex flex-row items-center justify-between gap-5 text-foreground-400">
          <DefaultSectionTitle />
          <span>
            <span>
              {field.renderMin(selectedValues[String(field.key)]?.split(";")[0] || minValue)}
            </span>{" "}
            -{" "}
            <span>
              {field.renderMax(selectedValues[String(field.key)]?.split(";")[1] || maxValue)}
            </span>
          </span>
        </span>
        <Slider color="foreground" onChange={debouncedOnChange} aria-label="Date" value={[
                Number(selectedValues[String(field.key)]?.split(";")[0]) ||
                    Number(minValue),
                Number(selectedValues[String(field.key)]?.split(";")[1]) ||
                    Number(maxValue),
            ]} maxValue={Number(maxValue)} minValue={Number(minValue)} size="sm" step={10}/>
      </div>);
    }
    return null;
};
export default Field;
