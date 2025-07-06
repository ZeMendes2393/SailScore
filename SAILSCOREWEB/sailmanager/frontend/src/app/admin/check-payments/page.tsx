"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.push("/");
    }
  }, [user, router]);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r p-6 space-y-4 shadow">
        <h2 className="text-2xl font-bold text-blue-600">ADMIN DASHBOARD</h2>
        <nav className="flex flex-col space-y-2 text-gray-700">
          <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
          <Link href="/admin/regattas" className="hover:text-blue-600">Regattas</Link>
          <Link href="/admin/users" className="hover:text-blue-600">Users</Link>
          <Link href="/admin/protests" className="hover:text-blue-600">Protests</Link>
          <Link href="/admin/settings" className="hover:text-blue-600">Settings</Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 bg-gray-50">
        <h1 className="text-3xl font-bold mb-6">Overview</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white p-6 rounded shadow text-center">
            <p className="text-4xl font-bold text-blue-600">5</p>
            <p>Regattas</p>
          </div>
          <div className="bg-white p-6 rounded shadow text-center">
            <p className="text-4xl font-bold text-green-600">350</p>
            <p>Competitors</p>
          </div>
          <div className="bg-white p-6 rounded shadow text-center">
            <p className="text-4xl font-bold text-indigo-600">20</p>
            <p>Races</p>
          </div>
          <div className="bg-white p-6 rounded shadow text-center">
            <p className="text-4xl font-bold text-red-600">2</p>
            <p>Open Protests</p>
          </div>
        </div>

        {/* Regatta Management */}
        <div className="mb-10">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold">Regatta Management</h2>
            <Link
              href="/admin/regattas/create"
              className="bg-blue-600 text-white px-4 py-1 rounded"
            >
              Add Regatta
            </Link>
          </div>
          <div className="bg-white rounded shadow overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Dates</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="p-4">Spring Regatta</td>
                  <td className="p-4">April 20–22</td>
                  <td className="p-4">Marinu Bay</td>
                  <td className="p-4 text-blue-600 font-medium">Upcoming</td>
                </tr>
                <tr className="border-t">
                  <td className="p-4">Sailing Championship</td>
                  <td className="p-4">March 12–17</td>
                  <td className="p-4">Harborview</td>
                  <td className="p-4 text-gray-500 font-medium">Completed</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* User Management */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">User Management</h2>
            <div className="bg-white rounded shadow">
              <ul className="divide-y">
                <li className="p-4">John Smith - john@example.com</li>
                <li className="p-4">Emma Wilson - emma@example.com</li>
              </ul>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">Recent Protests</h2>
            <div className="bg-white rounded shadow">
              <ul className="divide-y">
                <li className="p-4">#1011 - Sailing Championship - Pending</li>
                <li className="p-4">#1005 - Spring Regatta - Resolved</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
