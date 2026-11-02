import { Button } from "@heroui/button";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import { FilterProps, Primitive } from "./types";
import { useRef, useState } from "react";
import Field from "./field";
import { Badge } from "@heroui/badge";
import { clearAllQueryParams, useUrlQueryParams, } from "../../hooks/use-url-query-params";
export const FilterButton = <T,>(props: FilterProps<T>) => {
    const { data, fields } = props;
    const [parentPortal, setParentPortal] = useState<HTMLDivElement | null>(null);
    const activeFilters = useUrlQueryParams({
        queryParamKey: fields.map((f) => String(f.key)),
        mode: "LISTEN",
    });
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    return (<>
      <Popover placement="bottom">
        <Badge color="primary" content={Object.keys(activeFilters).length}>
          <PopoverTrigger>
            <Button isIconOnly variant="flat" ref={triggerRef}>
              <FilterAltRoundedIcon />
            </Button>
          </PopoverTrigger>
        </Badge>
        <PopoverContent className="relative p-4 border min-w-60 shadow-md bg-background rounded-xl">
          <div className="flex flex-col items-start gap-5" ref={(el) => {
            if (el)
                setParentPortal(el);
        }}>
            {parentPortal &&
            fields.map((field) => {
                const values = [
                    ...new Set(data.reduce((prev, item) => {
                        const returnedValue = field.value(item[field.key]);
                        if (Array.isArray(returnedValue))
                            return [...prev, ...returnedValue];
                        else
                            return [...prev, returnedValue];
                    }, [] as Primitive[])),
                ];
                return (<Field field={field.mode === "RANGE"
                        ? {
                            ...field,
                            values: values,
                        }
                        : { ...field, values }} parentPortal={parentPortal}/>);
            })}
            <Button color="danger" variant="faded" className="w-full" onPress={() => {
            clearAllQueryParams();
        }}>
              REMOVE ALL FILTERS
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>);
};
