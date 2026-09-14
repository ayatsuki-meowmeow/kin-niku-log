"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema, type CreateUserInput } from "@repo/schema";
import {
  useGetUsers,
  useCreateUser,
  useDeleteUser,
  getGetUsersQueryKey,
} from "@/generated/users/users";
import type { User } from "@/generated/model";

export default function Home() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetUsers();
  const users = data?.data ?? [];

  const { mutate: createUser } = useCreateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
        reset();
      },
    },
  });

  const { mutate: deleteUser } = useDeleteUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
      },
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserInput>({ resolver: zodResolver(createUserSchema) });

  return (
    <main className="max-w-xl mx-auto p-8 space-y-8">
      <h1 className="text-2xl font-bold">Users</h1>

      <form
        onSubmit={handleSubmit((values) => createUser({ data: values }))}
        className="space-y-3"
      >
        <div>
          <input
            {...register("name")}
            placeholder="Name"
            className="border rounded px-3 py-2 w-full"
          />
          {errors.name && (
            <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
          )}
        </div>
        <div>
          <input
            {...register("email")}
            placeholder="Email"
            className="border rounded px-3 py-2 w-full"
          />
          {errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
          )}
        </div>
        <button
          type="submit"
          className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
        >
          Add user
        </button>
      </form>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : users.length === 0 ? (
        <p className="text-gray-500">No users yet.</p>
      ) : (
        <ul className="space-y-2">
          {users.map((user: User) => (
            <li
              key={user.id}
              className="flex items-center justify-between border rounded px-4 py-3"
            >
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
              <button
                onClick={() => deleteUser({ id: user.id })}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
