import { FilterButton } from "./filter-button";
import { FilteredList } from "./filter-list";
import { FilterProps } from "./types";
const useFilter = <T,>(props: FilterProps<T>) => {
    return [<FilterButton {...props}/>, <FilteredList {...props}/>];
};
export default useFilter;
