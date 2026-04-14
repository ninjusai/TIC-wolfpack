/**
 * Create new supplement page (WRK-016).
 */
import type { Component } from "solid-js";
import SupplementForm from "../components/SupplementForm";

const SupplementNew: Component = () => {
  return (
    <div class="pb-24 md:pb-8 md:ml-56">
      <div class="max-w-xl mx-auto px-4 py-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Add Supplement
        </h1>
        <SupplementForm mode="create" />
      </div>
    </div>
  );
};

export default SupplementNew;
