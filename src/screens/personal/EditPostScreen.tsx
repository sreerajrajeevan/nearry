import React from "react";
import { PostEditor } from "./PostEditor";
import { EditPostProps } from "../../navigation/types";
export function EditPostScreen({ route, navigation }: EditPostProps) {
  return (
    <PostEditor
      key={route.params.postId}
      postId={route.params.postId}
      onSaved={() => navigation.goBack()}
      onCancel={() => navigation.goBack()}
    />
  );
}
