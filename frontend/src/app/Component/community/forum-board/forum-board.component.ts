import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { CommunityService, ForumTopic, Post } from '../../../service/community.service';
import { AuthService } from '../../../service/auth.service';
import { PostCardComponent } from '../post-card/post-card.component';

@Component({
  selector: 'app-forum-board',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, TranslateModule, PostCardComponent],
  templateUrl: './forum-board.component.html',
  styleUrl: './forum-board.component.css',
})
export class ForumBoardComponent implements OnInit {
  topics: ForumTopic[] = [];
  selectedTopic: ForumTopic | null = null;
  posts: Post[] = [];
  isLoadingTopics = false;
  isLoadingPosts = false;
  error = '';

  // New topic form
  showTopicForm = false;
  newTopicTitle = '';
  newTopicDesc = '';
  submittingTopic = false;

  constructor(
    private communityService: CommunityService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadTopics();
  }

  loadTopics(): void {
    this.isLoadingTopics = true;
    this.communityService.getTopics().subscribe({
      next: t => { this.topics = t; this.isLoadingTopics = false; },
      error: () => { this.isLoadingTopics = false; }
    });
  }

  selectTopic(topic: ForumTopic): void {
    this.selectedTopic = topic;
    this.isLoadingPosts = true;
    this.posts = [];
    this.communityService.getPosts(topic._id).subscribe({
      next: ({ posts }) => { this.posts = posts; this.isLoadingPosts = false; },
      error: () => { this.isLoadingPosts = false; }
    });
  }

  createTopic(): void {
    if (!this.newTopicTitle.trim()) return;
    const user = this.authService.currentUser;
    if (!user) return;
    this.submittingTopic = true;
    this.communityService.createTopic({
      userId: user.id,
      title: this.newTopicTitle.trim(),
      description: this.newTopicDesc.trim(),
    }).subscribe({
      next: topic => {
        this.topics.unshift(topic);
        this.newTopicTitle = '';
        this.newTopicDesc = '';
        this.showTopicForm = false;
        this.submittingTopic = false;
      },
      error: err => {
        this.error = err?.message || 'Could not create topic.';
        this.submittingTopic = false;
      }
    });
  }

  onLike(postId: string): void {
    const user = this.authService.currentUser;
    if (!user) return;
    this.communityService.likePost(postId, user.id).subscribe({
      next: ({ likes }) => {
        const p = this.posts.find(x => x._id === postId);
        if (p) p.likes = Array(likes).fill('');
      }
    });
  }

  onReport(postId: string): void {
    const user = this.authService.currentUser;
    if (!user) return;
    if (!confirm('Report this post?')) return;
    this.communityService.reportPost(postId, user.id).subscribe({
      next: ({ hidden }) => { if (hidden) this.posts = this.posts.filter(p => p._id !== postId); }
    });
  }

  onShare(postId: string): void {
    this.communityService.sharePost(postId).subscribe();
    const url = `${window.location.origin}/community?post=${postId}`;
    navigator.clipboard.writeText(url).then(() => alert('Link copied!')).catch(() => {});
  }
}
