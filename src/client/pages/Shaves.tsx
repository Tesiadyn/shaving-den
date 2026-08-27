import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ShaveEntry } from "../components/ShaveEntry";
import { Spinner } from "../components/Spinner";
import { Button, EmptyState, ErrorNote } from "../components/ui";

export function Shaves() {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const shaves = useQuery({
    queryKey: ["shaves"],
    queryFn: () => api.listShaves(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteShave(id),
    onSettled: () => {
      setDeletingId(null);
      // 使用次數是從日誌推導的，刪掉一筆日誌會改變所有相關品項的數字。
      queryClient.invalidateQueries({ queryKey: ["shaves"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["item"] });
      queryClient.invalidateQueries({ queryKey: ["item-shaves"] });
    },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">刮鬍日誌</h1>
        <Link to="/shaves/new" className="ml-auto">
          <Button variant="primary">記一次刮鬍</Button>
        </Link>
      </div>

      {shaves.isPending && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {shaves.isError && <ErrorNote>讀取日誌失敗，請重新整理。</ErrorNote>}

      {shaves.data &&
        (shaves.data.shaves.length === 0 ? (
          <EmptyState
            title="還沒有任何紀錄"
            description="記下今天用了哪片刀、哪塊皂，使用次數就會自動累計。"
            action={
              <Link to="/shaves/new">
                <Button variant="primary">記第一次</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {shaves.data.shaves.map((shave) => (
              <ShaveEntry
                key={shave.id}
                shave={shave}
                deleting={deletingId === shave.id}
                onDelete={() => {
                  setDeletingId(shave.id);
                  remove.mutate(shave.id);
                }}
              />
            ))}
          </div>
        ))}
    </div>
  );
}
