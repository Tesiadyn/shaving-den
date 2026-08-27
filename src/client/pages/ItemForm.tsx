import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { Spinner } from "../components/Spinner";
import {
  Button,
  ErrorNote,
  Field,
  Input,
  Select,
  Textarea,
} from "../components/ui";
import {
  CATEGORY_LABELS,
  CATEGORY_UNITS,
  CONSUMABLE_CATEGORIES,
  ITEM_CATEGORIES,
  ITEM_STATUSES,
  STATUS_LABELS,
  type ItemCategory,
  type ItemStatus,
} from "@/shared/domain";
import type { ItemDTO } from "@/shared/dto";

type FormState = {
  category: ItemCategory;
  brand: string;
  name: string;
  quantity: string;
  unit: string;
  status: ItemStatus;
  scentNotes: string;
  notes: string;
  productUrl: string;
  acquiredAt: string;
};

const BLANK: FormState = {
  category: "blade",
  brand: "",
  name: "",
  quantity: "1",
  unit: CATEGORY_UNITS.blade,
  status: "active",
  scentNotes: "",
  notes: "",
  productUrl: "",
  acquiredAt: "",
};

function toFormState(item: ItemDTO): FormState {
  return {
    category: item.category,
    brand: item.brand,
    name: item.name,
    quantity: String(item.quantity),
    unit: item.unit,
    status: item.status,
    scentNotes: item.scentNotes ?? "",
    notes: item.notes ?? "",
    productUrl: item.productUrl ?? "",
    acquiredAt: item.acquiredAt
      ? new Date(item.acquiredAt).toISOString().slice(0, 10)
      : "",
  };
}

export function ItemForm() {
  const params = useParams();
  const itemId = params.itemId;
  const isEdit = Boolean(itemId);

  const existing = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => api.getItem(itemId as string),
    enabled: isEdit,
  });

  if (isEdit && existing.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (isEdit && existing.isError) {
    return <ErrorNote>找不到這項用品。</ErrorNote>;
  }

  return (
    <ItemFormFields
      key={itemId ?? "new"}
      itemId={itemId}
      initial={existing.data ? toFormState(existing.data.item) : BLANK}
    />
  );
}

function ItemFormFields({
  itemId,
  initial,
}: {
  itemId: string | undefined;
  initial: FormState;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isEdit = Boolean(itemId);
  const isConsumable = CONSUMABLE_CATEGORIES.includes(form.category);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** 換分類時同步預設單位，除非使用者已經自己改過。 */
  function setCategory(next: ItemCategory) {
    setForm((f) => ({
      ...f,
      category: next,
      unit:
        f.unit === CATEGORY_UNITS[f.category] ? CATEGORY_UNITS[next] : f.unit,
      quantity: CONSUMABLE_CATEGORIES.includes(next) ? f.quantity : "1",
    }));
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        category: form.category,
        brand: form.brand.trim(),
        name: form.name.trim(),
        quantity: Number(form.quantity) || 0,
        unit: form.unit.trim() || CATEGORY_UNITS[form.category],
        status: form.status,
        scentNotes: form.scentNotes.trim() || null,
        notes: form.notes.trim() || null,
        productUrl: form.productUrl.trim() || null,
        acquiredAt: form.acquiredAt
          ? new Date(form.acquiredAt + "T00:00:00").getTime()
          : null,
      };

      return itemId ? api.updateItem(itemId, payload) : api.createItem(payload);
    },
    onSuccess: ({ item }) => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["item", item.id] });
      navigate("/den/" + item.id);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError && err.status === 400
          ? "有欄位填得不對，請檢查品牌與品名。"
          : "儲存失敗，請再試一次。",
      );
    },
  });

  function handleSubmit() {
    setError(null);
    if (!form.brand.trim() || !form.name.trim()) {
      setError("品牌與品名都要填。");
      return;
    }
    save.mutate();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="max-w-2xl"
    >
      <h1 className="mb-6 text-xl font-semibold tracking-tight">
        {isEdit ? "編輯用品" : "新增用品"}
      </h1>

      <div className="space-y-5">
        <Field label="分類">
          <Select
            value={form.category}
            onChange={(e) => setCategory(e.target.value as ItemCategory)}
          >
            {ITEM_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="品牌">
            <Input
              value={form.brand}
              onChange={(e) => set("brand", e.target.value)}
              placeholder="Feather"
              maxLength={80}
            />
          </Field>
          <Field label="品名">
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Hi-Stainless DE"
              maxLength={120}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field
            label="庫存數量"
            hint={isConsumable ? undefined : "耐久財固定為 1"}
          >
            <Input
              type="number"
              min={0}
              max={100000}
              value={form.quantity}
              disabled={!isConsumable}
              onChange={(e) => set("quantity", e.target.value)}
            />
          </Field>
          <Field label="單位">
            <Input
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
              maxLength={8}
            />
          </Field>
          <Field label="狀態">
            <Select
              value={form.status}
              onChange={(e) => set("status", e.target.value as ItemStatus)}
            >
              {ITEM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="氣味描述" hint="自由文字，之後可以用它搜尋">
          <Textarea
            rows={2}
            value={form.scentNotes}
            onChange={(e) => set("scentNotes", e.target.value)}
            placeholder="薰衣草、橡苔、皮革尾韻…"
            maxLength={500}
          />
        </Field>

        <Field label="備註">
          <Textarea
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="順滑度、刺激感、保存狀況…"
            maxLength={2000}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="商品頁網址" hint="填了就能自動抓商品圖">
            <Input
              type="url"
              value={form.productUrl}
              onChange={(e) => set("productUrl", e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field label="入手日期">
            <Input
              type="date"
              value={form.acquiredAt}
              onChange={(e) => set("acquiredAt", e.target.value)}
            />
          </Field>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {save.isPending ? "儲存中…" : isEdit ? "儲存變更" : "新增"}
          </Button>
          <Button onClick={() => navigate(-1)}>取消</Button>
        </div>
      </div>
    </form>
  );
}
