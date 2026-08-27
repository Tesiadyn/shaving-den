import { Link } from "react-router";
import { Button, EmptyState } from "../components/ui";

export function NotFound() {
  return (
    <EmptyState
      title="找不到這一頁"
      description="網址可能打錯了，或這筆資料已經被刪除。"
      action={
        <Link to="/den">
          <Button variant="primary">回到收藏</Button>
        </Link>
      }
    />
  );
}
