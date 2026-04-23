import { ComponentProps } from "react"
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left"
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      navLayout="around"
      className={cn("p-2 sm:p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "mx-auto grid w-fit grid-cols-[2rem_minmax(0,auto)_2rem] grid-rows-[2.75rem_auto] items-center gap-x-3 gap-y-3 sm:gap-x-4 sm:gap-y-4",
        month_caption: "col-start-2 row-start-1 flex h-11 items-center justify-center",
        caption_label: "mx-auto text-center text-sm font-medium leading-none",
        nav: "hidden",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "!static col-start-1 row-start-1 size-8 shrink-0 self-center justify-self-center bg-background p-0 opacity-70 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "!static col-start-3 row-start-1 size-8 shrink-0 self-center justify-self-center bg-background p-0 opacity-70 hover:opacity-100"
        ),
        month_grid: "col-span-3 row-start-2 mx-auto border-collapse space-y-1 px-2 sm:px-3",
        weekdays: "flex justify-center",
        weekday:
          "text-muted-foreground rounded-md w-10 font-normal text-[0.75rem] sm:w-9 sm:text-[0.8rem]",
        week: "mt-1 flex w-full justify-center sm:mt-2",
        day: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-range-end)]:rounded-r-md",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md"
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-10 p-0 text-sm font-normal aria-selected:opacity-100 sm:size-9"
        ),
        range_start:
          "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground",
        range_end:
          "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        outside:
          "day-outside text-muted-foreground aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...props }) => (
          orientation === "left" ?
            <ChevronLeft className={cn("size-4", className)} {...props} /> :
            <ChevronRight className={cn("size-4", className)} {...props} />
        ),
      }}
      {...props}
    />
  )
}

export { Calendar }
