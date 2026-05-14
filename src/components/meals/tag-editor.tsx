import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { client, orpc } from "#/orpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type Props = {
  mealId: number;
  initialTags: string[];
};

export function TagEditor({ mealId, initialTags }: Props) {
  const queryClient = useQueryClient();
  const [tags, setTagsLocal] = useState(initialTags);
  const [input, setInput] = useState("");

  const mutation = useMutation({
    mutationFn: (newTags: string[]) => client.meals.setTags({ id: mealId, tags: newTags }),
    onSuccess: (data) => {
      setTagsLocal(data);
      void queryClient.invalidateQueries({
        queryKey: orpc.meals.list.queryOptions().queryKey,
      });
    },
  });

  function addTag(tag: string) {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed || tags.includes(trimmed)) return;
    mutation.mutate([...tags, trimmed]);
    setInput("");
  }

  function removeTag(tag: string) {
    mutation.mutate(tags.filter((t) => t !== tag));
  }

  return (
    <div className="mt-6 border-t p-4">
      <h3 className="text-sm font-semibold mb-3">Tags</h3>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {tags.length === 0 && <p className="text-sm text-muted-foreground">No tags yet.</p>}
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs"
          >
            {tag}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => removeTag(tag)}
              disabled={mutation.isPending}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addTag(input);
        }}
        className="flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. quick, weeknight"
          className="h-8 text-sm"
        />
        <Button type="submit" size="sm" disabled={!input.trim() || mutation.isPending}>
          Add
        </Button>
      </form>
    </div>
  );
}
