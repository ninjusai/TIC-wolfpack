import type { Component } from "solid-js";
import { useParams } from "@solidjs/router";

const PipelineView: Component = () => {
  const params = useParams<{ slug: string }>();

  return (
    <div class="p-8">
      <h1 class="text-2xl font-bold text-text mb-2">Pipeline</h1>
      <p class="text-text-dim">Pipeline View: {params.slug}</p>
    </div>
  );
};

export default PipelineView;
