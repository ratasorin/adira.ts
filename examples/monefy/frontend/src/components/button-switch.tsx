import { VisuallyHidden, useSwitch } from "@heroui/react";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import DoNotDisturbRoundedIcon from "@mui/icons-material/DoNotDisturbRounded";
import { FC } from "react";
export const ButtonSwitch: FC<{
    checked: boolean;
    onCheck: (check: boolean) => void;
    checkedTitle: string;
    uncheckedTitle: string;
}> = ({ checked, onCheck, checkedTitle, uncheckedTitle }) => {
    const { Component, slots, isSelected, getBaseProps, getInputProps, getWrapperProps, } = useSwitch({
        isSelected: checked,
        onValueChange(isSelected) {
            onCheck(isSelected);
        },
    });
    return (<div className="flex gap-2 items-center">
      <Component {...getBaseProps()}>
        <VisuallyHidden>
          <input {...getInputProps()}/>
        </VisuallyHidden>
        <div {...getWrapperProps()} className={slots.wrapper({
            class: [
                "w-8 h-8",
                "flex items-center justify-center",
                "rounded-lg bg-default-100 hover:bg-default-200",
            ],
        })}>
          {isSelected ? (<CheckCircleOutlineRoundedIcon />) : (<DoNotDisturbRoundedIcon />)}
        </div>
      </Component>
      <p className="text-default-500 select-none">
        {isSelected ? checkedTitle : uncheckedTitle}
      </p>
    </div>);
};
