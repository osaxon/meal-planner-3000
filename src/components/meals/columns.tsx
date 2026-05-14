import {
  DIET_LABELS,
  SEASON_LABELS,
  type Meal,
  type MealWithCategory,
} from "#/domains/meals/meals.zod";
import { type Column, type ColumnDef } from "@tanstack/react-table";
import { PencilIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

function SelectFilter({
  column,
  labels,
}: {
  column: Column<MealWithCategory, unknown>;
  labels?: Record<string, string>;
}) {
  const options = Array.from(column.getFacetedUniqueValues().keys()).sort() as string[];
  const filterValue = (column.getFilterValue() as string) ?? "";

  return (
    <Select
      value={filterValue}
      onValueChange={(v) => column.setFilterValue(v === "__all__" ? undefined : v)}
    >
      <SelectTrigger>
        <SelectValue placeholder="All" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {labels?.[opt] ?? opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const getMealColumns = ({
  onEdit,
}: {
  onEdit: (meal: MealWithCategory) => void;
}): ColumnDef<MealWithCategory>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableColumnFilter: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Meal",
    enableColumnFilter: false,
  },
  {
    accessorKey: "diet",
    header: ({ column }) => (
      <SelectFilter column={column} labels={DIET_LABELS as Record<string, string>} />
    ),
    cell: ({ row }) => {
      const diet = row.getValue("diet") as Meal["diet"];
      return <span className="capitalize">{diet}</span>;
    },
  },
  {
    accessorKey: "categoryName",
    header: ({ column }) => <SelectFilter column={column} />,
  },
  {
    accessorKey: "season",
    header: ({ column }) => (
      <SelectFilter column={column} labels={SEASON_LABELS as Record<string, string>} />
    ),
    cell: ({ row }) => {
      return SEASON_LABELS[row.getValue("season") as Meal["season"]];
    },
  },
  {
    id: "actions",
    enableColumnFilter: false,
    cell: ({ row }) => {
      const meal = row.original;

      return (
        <Button size="icon" variant="outline" onClick={() => onEdit(meal)}>
          <PencilIcon />
        </Button>
      );
    },
  },
];
