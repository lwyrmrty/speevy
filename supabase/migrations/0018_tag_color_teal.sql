-- Add 'teal' to the tags.color CHECK constraint (Untitled UI Badge palette).

alter table public.tags drop constraint tags_color_check;

alter table public.tags add constraint tags_color_check check (
  color in (
    'gray', 'brand', 'error', 'warning', 'success', 'slate',
    'sky', 'blue', 'indigo', 'purple', 'pink', 'orange', 'teal'
  )
);
