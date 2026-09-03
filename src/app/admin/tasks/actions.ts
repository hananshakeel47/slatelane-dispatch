"use server";

import { revalidatePath } from "next/cache";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


function revalidateTaskPaths(
  leadId?: string | null
) {
  revalidatePath(
    "/admin/tasks"
  );

  revalidatePath(
    "/admin/replies"
  );

  revalidatePath(
    "/admin/dashboard"
  );

  revalidatePath(
    "/admin/leads"
  );

  if (leadId) {
    revalidatePath(
      `/admin/leads/${leadId}`
    );
  }
}


async function getTask(
  taskId: string
) {
  const supabase =
    createAdminSupabase();

  const {
    data,
    error,
  } = await supabase
    .from("lead_tasks")
    .select(`
      id,
      lead_id,
      status,
      priority,
      due_at
    `)
    .eq(
      "id",
      taskId
    )
    .maybeSingle();

  if (
    error ||
    !data
  ) {
    throw new Error(
      error?.message ||
        "Task not found."
    );
  }

  return data;
}


export async function completeTaskAction(
  formData: FormData
) {
  const taskId =
    String(
      formData.get(
        "taskId"
      ) ?? ""
    ).trim();

  if (!taskId) {
    throw new Error(
      "Missing task ID."
    );
  }

  const task =
    await getTask(
      taskId
    );

  if (
    task.status ===
    "completed"
  ) {
    revalidateTaskPaths(
      task.lead_id
    );

    return;
  }

  const supabase =
    createAdminSupabase();

  const now =
    new Date().toISOString();

  const {
    error,
  } = await supabase
    .from("lead_tasks")
    .update({
      status:
        "completed",

      completed_at:
        now,

      updated_at:
        now,
    })
    .eq(
      "id",
      taskId
    );

  if (error) {
    throw new Error(
      `Could not complete task: ${error.message}`
    );
  }

  revalidateTaskPaths(
    task.lead_id
  );
}


export async function cancelTaskAction(
  formData: FormData
) {
  const taskId =
    String(
      formData.get(
        "taskId"
      ) ?? ""
    ).trim();

  if (!taskId) {
    throw new Error(
      "Missing task ID."
    );
  }

  const task =
    await getTask(
      taskId
    );

  if (
    task.status ===
    "cancelled"
  ) {
    revalidateTaskPaths(
      task.lead_id
    );

    return;
  }

  const supabase =
    createAdminSupabase();

  const now =
    new Date().toISOString();

  const {
    error,
  } = await supabase
    .from("lead_tasks")
    .update({
      status:
        "cancelled",

      completed_at:
        null,

      updated_at:
        now,
    })
    .eq(
      "id",
      taskId
    );

  if (error) {
    throw new Error(
      `Could not cancel task: ${error.message}`
    );
  }

  revalidateTaskPaths(
    task.lead_id
  );
}


export async function reopenTaskAction(
  formData: FormData
) {
  const taskId =
    String(
      formData.get(
        "taskId"
      ) ?? ""
    ).trim();

  if (!taskId) {
    throw new Error(
      "Missing task ID."
    );
  }

  const task =
    await getTask(
      taskId
    );

  const supabase =
    createAdminSupabase();

  const now =
    new Date().toISOString();

  const {
    error,
  } = await supabase
    .from("lead_tasks")
    .update({
      status:
        "open",

      completed_at:
        null,

      updated_at:
        now,
    })
    .eq(
      "id",
      taskId
    );

  if (error) {
    throw new Error(
      `Could not reopen task: ${error.message}`
    );
  }

  revalidateTaskPaths(
    task.lead_id
  );
}


export async function rescheduleTaskAction(
  formData: FormData
) {
  const taskId =
    String(
      formData.get(
        "taskId"
      ) ?? ""
    ).trim();

  const offsetHours =
    Number(
      formData.get(
        "offsetHours"
      )
    );

  if (!taskId) {
    throw new Error(
      "Missing task ID."
    );
  }

  if (
    !Number.isFinite(
      offsetHours
    ) ||
    offsetHours <= 0
  ) {
    throw new Error(
      "Invalid reschedule duration."
    );
  }

  const task =
    await getTask(
      taskId
    );

  const supabase =
    createAdminSupabase();

  const now =
    Date.now();

  /*
   * We intentionally reschedule
   * relative to NOW instead of the
   * previous due date.
   *
   * This prevents an overdue task
   * from remaining overdue after it
   * is pushed forward.
   */
  const dueAt =
    new Date(
      now +
        offsetHours *
          60 *
          60 *
          1000
    ).toISOString();

  const updatedAt =
    new Date().toISOString();

  const {
    error,
  } = await supabase
    .from("lead_tasks")
    .update({
      status:
        "open",

      due_at:
        dueAt,

      completed_at:
        null,

      updated_at:
        updatedAt,
    })
    .eq(
      "id",
      taskId
    );

  if (error) {
    throw new Error(
      `Could not reschedule task: ${error.message}`
    );
  }

  revalidateTaskPaths(
    task.lead_id
  );
}


export async function updateTaskPriorityAction(
  formData: FormData
) {
  const taskId =
    String(
      formData.get(
        "taskId"
      ) ?? ""
    ).trim();

  const priority =
    String(
      formData.get(
        "priority"
      ) ?? ""
    ).trim();

  const allowed =
    new Set([
      "low",
      "normal",
      "high",
      "urgent",
    ]);

  if (!taskId) {
    throw new Error(
      "Missing task ID."
    );
  }

  if (
    !allowed.has(
      priority
    )
  ) {
    throw new Error(
      "Invalid priority."
    );
  }

  const task =
    await getTask(
      taskId
    );

  const supabase =
    createAdminSupabase();

  const {
    error,
  } = await supabase
    .from("lead_tasks")
    .update({
      priority,
      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      taskId
    );

  if (error) {
    throw new Error(
      `Could not update priority: ${error.message}`
    );
  }

  revalidateTaskPaths(
    task.lead_id
  );
}